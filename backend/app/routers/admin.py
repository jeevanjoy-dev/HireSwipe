
import mimetypes
from datetime import datetime
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, aliased
from sqlalchemy import or_

from app.database import get_db
from app.dependencies.auth import get_current_admin

from app.models.user import User
from app.models.company import Company
from app.models.company_verification_request import CompanyVerificationRequest
from app.models.job import Job
from app.models.application import Application
from app.models.recruiter_profile import RecruiterProfile
from app.models.company_join_request import CompanyJoinRequest
from app.models.candidate_profile import CandidateProfile
from app.models.job_reapproval_request import JobReapprovalRequest
from app.schemas.job_reapproval import JobReapprovalReview

from app.services.file_storage import get_stored_file


router = APIRouter(
    prefix="/admin",
    tags=["Platform Admin"]
)


# --------------------------------------------------
# DOMAIN VALIDATION
# --------------------------------------------------

def get_domain(value: str | None) -> str | None:
    """Extract a normalized domain from a website or email."""

    if not value:
        return None

    value = value.strip().lower()

    if "://" not in value:
        value = f"https://{value}"

    domain = urlsplit(value).hostname

    if not domain:
        return None

    return domain.removeprefix("www.")


def company_email_domain_matches(company: Company) -> bool:
    """Check whether the business email matches the company website."""

    if not company.business_email or not company.website:
        return False

    email_domain = company.business_email.rsplit("@", 1)[-1].lower()
    website_domain = get_domain(company.website)

    return email_domain == website_domain


def email_domain_matches_website(
    email: str | None,
    website: str | None
) -> bool:
    """Check whether a specific email matches the company website domain."""

    if not email or not website or "@" not in email:
        return False

    email_domain = email.rsplit("@", 1)[-1].strip().lower()
    website_domain = get_domain(website)

    return bool(website_domain and email_domain == website_domain)


# --------------------------------------------------
# COMPANY VERIFICATION HELPERS
# --------------------------------------------------

def get_latest_verification_request(
    db: Session,
    company_id: int
):
    """Return the latest verification request for a company."""

    return (
        db.query(CompanyVerificationRequest)
        .filter(
            CompanyVerificationRequest.company_id == company_id
        )
        .order_by(
            CompanyVerificationRequest.version_number.desc()
        )
        .first()
    )


def get_verification_request(
    db: Session,
    company_id: int,
    request_id: int | None = None
):
    """Return a specific request or the latest request."""

    query = db.query(CompanyVerificationRequest).filter(
        CompanyVerificationRequest.company_id == company_id
    )

    if request_id is not None:
        return query.filter(
            CompanyVerificationRequest.id == request_id
        ).first()

    return query.order_by(
        CompanyVerificationRequest.version_number.desc()
    ).first()


def ensure_legacy_verification_request(
    db: Session,
    company: Company
):
    """Preserve legacy company verification documents."""

    existing_request = get_latest_verification_request(
        db,
        company.id
    )

    if existing_request:
        return existing_request

    status_mapping = {
        "verified": "approved",
        "pending_review": "pending",
        "rejected": "rejected"
    }

    legacy_status = status_mapping.get(
        company.verification_status,
        "draft"
    )

    if (
        not company.document_1
        and not company.document_2
        and legacy_status == "draft"
    ):
        return None

    request = CompanyVerificationRequest(
        company_id=company.id,
        request_type="initial",
        version_number=1,
        document_1=company.document_1,
        document_2=company.document_2,
        status=legacy_status,
        submitted_at=(
            company.business_email_verified_at
            if legacy_status in {"pending", "approved", "rejected"}
            else None
        )
    )

    db.add(request)
    db.flush()

    return request


def ensure_legacy_pending_requests(db: Session):
    """Backfill legacy pending companies."""

    legacy_companies = (
        db.query(Company)
        .filter(
            Company.verification_status == "pending_review",
            ~Company.id.in_(
                db.query(
                    CompanyVerificationRequest.company_id
                )
            )
        )
        .all()
    )

    for company in legacy_companies:
        ensure_legacy_verification_request(
            db,
            company
        )


# --------------------------------------------------
# ADMIN DASHBOARD
# --------------------------------------------------

@router.get("/dashboard")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return platform-wide statistics."""

    total_candidates = db.query(User).filter(
        User.role == "candidate"
    ).count()

    total_recruiters = db.query(User).filter(
        User.role == "recruiter"
    ).count()

    total_companies = db.query(Company).count()

    total_jobs = db.query(Job).count()

    active_jobs = db.query(Job).filter(
        Job.is_active.is_(True)
    ).count()

    inactive_jobs = db.query(Job).filter(
        Job.is_active.is_(False)
    ).count()

    total_applications = db.query(Application).count()

    ensure_legacy_pending_requests(db)

    pending_verifications = (
        db.query(CompanyVerificationRequest)
        .filter(
            CompanyVerificationRequest.status == "pending"
        )
        .count()
    )

    verified_companies = db.query(Company).filter(
        Company.verification_status == "verified"
    ).count()

    db.commit()

    return {
        "message": "Admin dashboard statistics retrieved successfully.",
        "admin": {
            "id": admin.id,
            "name": admin.name,
            "email": admin.email
        },
        "statistics": {
            "total_candidates": total_candidates,
            "total_recruiters": total_recruiters,
            "total_companies": total_companies,
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "inactive_jobs": inactive_jobs,
            "total_applications": total_applications,
            "pending_verifications": pending_verifications,
            "verified_companies": verified_companies
        }
    }


# --------------------------------------------------
# LIST ALL COMPANIES
# --------------------------------------------------

@router.get("/companies")
def get_all_companies(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return all companies and their latest verification details."""

    companies = db.query(Company).order_by(
        Company.id.desc()
    ).all()

    results = []

    for company in companies:

        request = get_latest_verification_request(
            db,
            company.id
        )

        if request is None:
            request = ensure_legacy_verification_request(
                db,
                company
            )

        document_1 = (
            request.document_1
            if request
            else company.document_1
        )

        document_2 = (
            request.document_2
            if request
            else company.document_2
        )

        business_email = (
            request.business_email
            if request
            else company.business_email
        )

        email_verified = (
            request.business_email_verified
            if request
            else company.business_email_verified
        )

        results.append({
            "id": company.id,
            "name": company.name,
            "website": company.website,

            "business_email": business_email,
            "business_email_verified": bool(email_verified),
            "domain_match": email_domain_matches_website(
                business_email,
                company.website
            ),

            "business_phone": company.business_phone,
            "business_address": company.business_address,

            "document_1_uploaded": bool(document_1),
            "document_2_uploaded": bool(document_2),

            "documents_status": company.documents_status,
            "verification_status": company.verification_status,

            "request_id": request.id if request else None,
            "request_type": request.request_type if request else None,
            "request_status": request.status if request else None,
            "version_number": request.version_number if request else None,
            "submitted_at": request.submitted_at if request else None
        })

    db.commit()

    return results


# --------------------------------------------------
# LIST PENDING VERIFICATION REQUESTS
# --------------------------------------------------

@router.get("/companies/pending")
def get_pending_companies(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return all verification requests awaiting admin review."""

    ensure_legacy_pending_requests(db)

    requests = (
        db.query(CompanyVerificationRequest)
        .filter(
            CompanyVerificationRequest.status == "pending"
        )
        .order_by(
            CompanyVerificationRequest.submitted_at.asc()
        )
        .all()
    )

    results = []

    for request in requests:

        company = db.query(Company).filter(
            Company.id == request.company_id
        ).first()

        if not company:
            continue

        results.append({
            "id": company.id,
            "name": company.name,
            "website": company.website,

            "business_email": request.business_email,
            "business_email_verified": bool(
                request.business_email_verified
            ),
            "domain_match": email_domain_matches_website(
                request.business_email,
                company.website
            ),

            "business_phone": company.business_phone,
            "business_address": company.business_address,

            "document_1_uploaded": bool(request.document_1),
            "document_2_uploaded": bool(request.document_2),

            "documents_status": company.documents_status,
            "verification_status": company.verification_status,

            "request_id": request.id,
            "request_type": request.request_type,
            "request_status": request.status,
            "version_number": request.version_number,
            "submitted_at": request.submitted_at
        })

    db.commit()

    return results


# --------------------------------------------------
# VIEW COMPANY VERIFICATION DETAILS
# --------------------------------------------------

@router.get("/companies/{company_id}")
def get_company_verification_details(
    company_id: int,
    request_id: int | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return company details and verification history."""

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    request = get_verification_request(
        db,
        company_id,
        request_id
    )

    if request_id is not None and request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification request not found."
        )

    if request is None:
        request = ensure_legacy_verification_request(
            db,
            company
        )
        db.commit()

    document_1 = (
        request.document_1
        if request
        else company.document_1
    )

    document_2 = (
        request.document_2
        if request
        else company.document_2
    )

    business_email = (
        request.business_email
        if request
        else company.business_email
    )

    email_verified = (
        request.business_email_verified
        if request
        else company.business_email_verified
    )

    email_verified_at = (
        request.business_email_verified_at
        if request
        else company.business_email_verified_at
    )

    verification_history = (
        db.query(CompanyVerificationRequest)
        .filter(
            CompanyVerificationRequest.company_id == company_id
        )
        .order_by(
            CompanyVerificationRequest.version_number.desc()
        )
        .all()
    )

    return {
        "id": company.id,
        "name": company.name,
        "description": company.description,
        "location": company.location,
        "website": company.website,

        "business_email": business_email,
        "business_email_verified": bool(email_verified),
        "business_email_verified_at": email_verified_at,

        "website_domain": get_domain(company.website),
        "email_domain": (
            business_email.rsplit("@", 1)[-1].lower()
            if business_email and "@" in business_email
            else None
        ),
        "domain_match": email_domain_matches_website(
            business_email,
            company.website
        ),

        "business_phone": company.business_phone,
        "business_address": company.business_address,

        "document_1_uploaded": bool(document_1),
        "document_2_uploaded": bool(document_2),

        "documents_status": company.documents_status,
        "verification_status": company.verification_status,

        "request_id": request.id if request else None,
        "request_type": request.request_type if request else None,
        "request_status": request.status if request else None,
        "version_number": request.version_number if request else None,

        "submitted_at": request.submitted_at if request else None,
        "reviewed_at": request.reviewed_at if request else None,
        "rejection_reason": request.rejection_reason if request else None,

        "verification_history": [
            {
                "id": history.id,
                "request_type": history.request_type,
                "version_number": history.version_number,
                "status": history.status,
                "business_email": history.business_email,
                "business_email_verified": bool(
                    history.business_email_verified
                ),
                "submitted_at": history.submitted_at,
                "reviewed_at": history.reviewed_at,
                "rejection_reason": history.rejection_reason
            }
            for history in verification_history
        ]
    }


# --------------------------------------------------
# VIEW COMPANY VERIFICATION DOCUMENT
# --------------------------------------------------

@router.get(
    "/companies/{company_id}/documents/{document_number}"
)
def view_company_document(
    company_id: int,
    document_number: int,
    request_id: int | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Allow admins to view documents from a specific request."""

    if document_number not in (1, 2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document number must be 1 or 2."
        )

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    request = get_verification_request(
        db,
        company_id,
        request_id
    )

    if request_id is not None and request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification request not found."
        )

    if request:
        storage_key = (
            request.document_1
            if document_number == 1
            else request.document_2
        )
    else:
        storage_key = (
            company.document_1
            if document_number == 1
            else company.document_2
        )

    if not storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company document not found."
        )

    file_path = get_stored_file(storage_key)

    media_type = (
        mimetypes.guess_type(file_path.name)[0]
        or "application/octet-stream"
    )

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=file_path.name,
        content_disposition_type="inline"
    )


# --------------------------------------------------
# APPROVE COMPANY VERIFICATION REQUEST
# --------------------------------------------------

@router.put("/companies/{company_id}/approve")
def approve_company(
    company_id: int,
    request_id: int | None = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Approve an initial or re-verification request."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .with_for_update()
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    request = get_verification_request(
        db,
        company_id,
        request_id
    )

    if request is None and request_id is None:
        request = ensure_legacy_verification_request(
            db,
            company
        )

    if request is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification request found."
        )

    if request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending verification requests can be approved."
        )

    if not request.business_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business email is required for this verification request."
        )

    if not request.business_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business email must be verified for this request."
        )

    if not email_domain_matches_website(
        request.business_email,
        company.website
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business email domain does not match the company website."
        )

    if not company.business_phone or not company.business_phone.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business phone number is required."
        )

    if not company.business_address or not company.business_address.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business postal address is required."
        )

    if not request.document_1 or not request.document_2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both company verification documents must be uploaded."
        )

    request.status = "approved"
    request.reviewed_at = datetime.utcnow()
    request.reviewed_by_user_id = current_admin.id
    request.rejection_reason = None

    company.document_1 = request.document_1
    company.document_2 = request.document_2

    company.business_email = request.business_email
    company.business_email_verified = True
    company.business_email_verified_at = (
        request.business_email_verified_at
    )

    company.verification_status = "verified"
    company.documents_status = "approved"

    db.commit()
    db.refresh(request)
    db.refresh(company)

    return {
        "message": "Company verification request approved successfully.",
        "company_id": company.id,
        "request_id": request.id,
        "request_type": request.request_type,
        "request_status": request.status,
        "verification_status": company.verification_status,
        "documents_status": company.documents_status
    }


# --------------------------------------------------
# REJECT COMPANY VERIFICATION REQUEST
# --------------------------------------------------

@router.put("/companies/{company_id}/reject")
def reject_company(
    company_id: int,
    request_id: int | None = None,
    rejection_reason: str | None = Body(default=None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Reject an initial or re-verification request."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .with_for_update()
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    verification_request = get_verification_request(
        db,
        company_id,
        request_id
    )

    if verification_request is None and request_id is None:
        verification_request = ensure_legacy_verification_request(
            db,
            company
        )

    if verification_request is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification request found."
        )

    if verification_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending verification requests can be rejected."
        )

    normalized_reason = (
        rejection_reason.strip()
        if isinstance(rejection_reason, str)
        else None
    )

    if normalized_reason == "":
        normalized_reason = None

    previously_approved = (
        db.query(CompanyVerificationRequest.id)
        .filter(
            CompanyVerificationRequest.company_id == company.id,
            CompanyVerificationRequest.status == "approved",
            CompanyVerificationRequest.id != verification_request.id
        )
        .first()
        is not None
    )

    verification_request.status = "rejected"
    verification_request.reviewed_at = datetime.utcnow()
    verification_request.reviewed_by_user_id = admin.id
    verification_request.rejection_reason = normalized_reason

    company.documents_status = "rejected"

    if previously_approved:
        company.verification_status = "inactive"
    else:
        company.verification_status = "rejected"

    db.commit()

    db.refresh(verification_request)
    db.refresh(company)

    return {
        "message": "Company verification request rejected.",
        "company_id": company.id,
        "company_name": company.name,
        "request_id": verification_request.id,
        "request_type": verification_request.request_type,
        "request_status": verification_request.status,
        "rejection_reason": verification_request.rejection_reason,
        "documents_status": company.documents_status,
        "verification_status": company.verification_status
    }


# --------------------------------------------------
# LIST ALL RECRUITERS
# --------------------------------------------------

@router.get("/recruiters")
def get_all_recruiters(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return all recruiters with their company and account details."""

    recruiters = (
        db.query(User, RecruiterProfile)
        .outerjoin(
            RecruiterProfile,
            RecruiterProfile.user_id == User.id
        )
        .filter(User.role == "recruiter")
        .order_by(User.id.desc())
        .all()
    )

    results = []

    for user, profile in recruiters:

        admin_company = db.query(Company).filter(
            Company.admin_user_id == user.id
        ).first()

        company = None

        if profile and profile.company_id:
            company = db.query(Company).filter(
                Company.id == profile.company_id
            ).first()

        if admin_company:
            recruiter_type = "company_admin"
            company = admin_company

        elif company:
            recruiter_type = "secondary_recruiter"

        else:
            recruiter_type = "unassociated"

        pending_request = db.query(CompanyJoinRequest).filter(
            CompanyJoinRequest.recruiter_id == user.id,
            CompanyJoinRequest.status == "pending"
        ).first()

        if pending_request and recruiter_type == "unassociated":
            recruiter_type = "pending"

        results.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "email_verified": user.email_verified,
            "is_blocked": user.is_blocked,
            "blocked_reason": user.blocked_reason,
            "blocked_at": user.blocked_at,

            "recruiter_profile_id": profile.id if profile else None,
            "designation": profile.designation if profile else None,
            "profile_photo": profile.profile_photo if profile else None,

            "recruiter_type": recruiter_type,

            "company": {
                "id": company.id,
                "name": company.name,
                "verification_status": company.verification_status
            } if company else None
        })

    return results


# --------------------------------------------------
# VIEW RECRUITER DETAILS
# --------------------------------------------------


@router.get("/recruiters/{recruiter_id}")
def get_recruiter_details(
    recruiter_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return detailed information about an individual recruiter."""

    recruiter = db.query(User).filter(
        User.id == recruiter_id,
        User.role == "recruiter"
    ).first()

    if not recruiter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found."
        )

    profile = db.query(RecruiterProfile).filter(
        RecruiterProfile.user_id == recruiter.id
    ).first()

    company = db.query(Company).filter(
        Company.admin_user_id == recruiter.id
    ).first()

    if not company and profile and profile.company_id:
        company = db.query(Company).filter(
            Company.id == profile.company_id
        ).first()

    pending_requests = db.query(CompanyJoinRequest).filter(
        CompanyJoinRequest.recruiter_id == recruiter.id,
        CompanyJoinRequest.status == "pending"
    ).all()

    if company and company.admin_user_id == recruiter.id:
        recruiter_type = "company_admin"
    elif company:
        recruiter_type = "secondary_recruiter"
    elif pending_requests:
        recruiter_type = "pending"
    else:
        recruiter_type = "unassociated"

    return {
        "id": recruiter.id,
        "name": recruiter.name,
        "email": recruiter.email,
        "email_verified": recruiter.email_verified,

        # Recruiter blocking information
        "is_blocked": recruiter.is_blocked,
        "blocked_reason": recruiter.blocked_reason,
        "blocked_at": recruiter.blocked_at,

        "recruiter_profile": {
            "id": profile.id,
            "designation": profile.designation,
            "profile_photo": profile.profile_photo
        } if profile else None,

        "recruiter_type": recruiter_type,

        "company": {
            "id": company.id,
            "name": company.name,
            "website": company.website,
            "location": company.location,
            "verification_status": company.verification_status
        } if company else None,

        "pending_join_requests": len(pending_requests)
    }


# --------------------------------------------------
# LIST ALL CANDIDATES
# --------------------------------------------------

@router.get("/candidates")
def get_all_candidates(
    skip: int = 0,
    limit: int = 20,
    search: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return candidate accounts with basic profile information."""

    if skip < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skip cannot be negative."
        )

    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100."
        )

    query = (
        db.query(User, CandidateProfile)
        .outerjoin(
            CandidateProfile,
            CandidateProfile.user_id == User.id
        )
        .filter(User.role == "candidate")
    )

    if search and search.strip():
        search_term = f"%{search.strip()}%"

        query = query.filter(
            (User.name.ilike(search_term)) |
            (User.email.ilike(search_term))
        )

    total = query.count()

    candidates = (
        query
        .order_by(User.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []

    for user, profile in candidates:
        results.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "email_verified": user.email_verified,
            "phone_verified": user.phone_verified,
            "created_at": user.created_at,

            "candidate_profile_id": (
                profile.id if profile else None
            ),

            "location": (
                profile.location if profile else None
            ),

            "has_resume": bool(
                profile and profile.resume
            ),

            "resume_filename": (
                profile.resume_filename if profile else None
            ),

            "has_profile_photo": bool(
                profile and profile.profile_photo
            )
        })

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "candidates": results
    }


# --------------------------------------------------
# VIEW CANDIDATE DETAILS
# --------------------------------------------------

@router.get("/candidates/{candidate_id}")
def get_candidate_details(
    candidate_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return detailed information about an individual candidate."""

    candidate = db.query(User).filter(
        User.id == candidate_id,
        User.role == "candidate"
    ).first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found."
        )

    profile = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == candidate.id
    ).first()

    return {
        "id": candidate.id,
        "name": candidate.name,
        "email": candidate.email,
        "phone": candidate.phone,
        "email_verified": candidate.email_verified,
        "phone_verified": candidate.phone_verified,
        "created_at": candidate.created_at,

        "candidate_profile": {
            "id": profile.id,
            "location": profile.location,
            "bio": profile.bio,
            "has_resume": bool(profile.resume),
            "resume_filename": profile.resume_filename,
            "has_profile_photo": bool(profile.profile_photo)
        } if profile else None
    }


# --------------------------------------------------
# LIST ALL JOBS
# --------------------------------------------------

@router.get("/jobs")
def get_all_jobs(
    skip: int = 0,
    limit: int = 20,
    search: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return all jobs with recruiter and company information."""

    if skip < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skip cannot be negative."
        )

    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100."
        )

    ProfileCompany = aliased(Company)
    AdminCompany = aliased(Company)

    query = (
        db.query(
            Job,
            User,
            ProfileCompany,
            AdminCompany
        )
        .join(
            RecruiterProfile,
            Job.recruiter_id == RecruiterProfile.id
        )
        .join(
            User,
            RecruiterProfile.user_id == User.id
        )
        .outerjoin(
            ProfileCompany,
            RecruiterProfile.company_id == ProfileCompany.id
        )
        .outerjoin(
            AdminCompany,
            AdminCompany.admin_user_id == User.id
        )
    )

    if search and search.strip():
        search_term = f"%{search.strip()}%"

        query = query.filter(
            (Job.title.ilike(search_term)) |
            (User.name.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (ProfileCompany.name.ilike(search_term)) |
            (AdminCompany.name.ilike(search_term))
        )

    total = query.count()

    jobs = (
        query
        .order_by(Job.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []

    for job, recruiter, profile_company, admin_company in jobs:

        company = (
            profile_company
            if profile_company is not None
            else admin_company
        )

        results.append({
            "id": job.id,
            "title": job.title,
            "location": job.location,
            "job_type": job.job_type,
            "experience_min": job.experience_min,
            "experience_max": job.experience_max,
            "salary_min": job.salary_min,
            "salary_max": job.salary_max,
            "application_method": job.application_method,
            "is_active": job.is_active,
            "created_at": job.created_at,
            "moderation_status": job.moderation_status,
            "moderation_reason": job.moderation_reason,
            "moderated_at": job.moderated_at,

            "recruiter": {
                "id": recruiter.id,
                "name": recruiter.name,
                "email": recruiter.email
            },

            "company": {
                "id": company.id,
                "name": company.name
            } if company else None
        })

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "jobs": results
    }


# --------------------------------------------------
# VIEW JOB DETAILS
# --------------------------------------------------


@router.get("/jobs/{job_id}")
def get_job_details(
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return complete information about an individual job."""

    ProfileCompany = aliased(Company)
    AdminCompany = aliased(Company)

    result = (
        db.query(
            Job,
            User,
            RecruiterProfile,
            ProfileCompany,
            AdminCompany
        )
        .join(
            RecruiterProfile,
            Job.recruiter_id == RecruiterProfile.id
        )
        .join(
            User,
            RecruiterProfile.user_id == User.id
        )
        .outerjoin(
            ProfileCompany,
            RecruiterProfile.company_id == ProfileCompany.id
        )
        .outerjoin(
            AdminCompany,
            AdminCompany.admin_user_id == User.id
        )
        .filter(Job.id == job_id)
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found."
        )

    (
        job,
        recruiter,
        recruiter_profile,
        profile_company,
        admin_company
    ) = result

    company = (
        profile_company
        if profile_company is not None
        else admin_company
    )

    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "location": job.location,
        "job_type": job.job_type,

        "experience_min": job.experience_min,
        "experience_max": job.experience_max,

        "salary_min": job.salary_min,
        "salary_max": job.salary_max,

        "requirements": job.requirements,

        "application_method": job.application_method,
        "application_url": job.application_url,
        "application_email": job.application_email,

        "is_active": job.is_active,
        "created_at": job.created_at,

        # Moderation information
        "moderation_status": job.moderation_status,
        "moderation_reason": job.moderation_reason,
        "moderated_at": job.moderated_at,
        "moderated_by": job.moderated_by,

        "recruiter": {
            "id": recruiter.id,
            "name": recruiter.name,
            "email": recruiter.email,
            "designation": recruiter_profile.designation,
            "is_blocked": recruiter.is_blocked,
            "blocked_reason": recruiter.blocked_reason
        },

        "company": {
            "id": company.id,
            "name": company.name,
            "website": company.website,
            "location": company.location,
            "verification_status": company.verification_status
        } if company else None
    }


# --------------------------------------------------
# ACTIVATE OR DEACTIVATE JOB
# --------------------------------------------------


@router.put("/jobs/{job_id}/status")
def update_job_status(
    job_id: int,
    is_active: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Allow admin to activate or deactivate jobs safely."""

    job = db.query(Job).filter(
        Job.id == job_id
    ).with_for_update().first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found."
        )

    if is_active:

        if job.moderation_status == "deactivated":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permanently deactivated jobs cannot be reactivated."
            )

        if job.moderation_status in {"hidden", "pending_reapproval"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This job requires moderation approval before activation."
            )

        recruiter_profile = db.query(RecruiterProfile).filter(
            RecruiterProfile.id == job.recruiter_id
        ).first()

        if not recruiter_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recruiter profile not found."
            )

        recruiter = db.query(User).filter(
            User.id == recruiter_profile.user_id
        ).first()

        if not recruiter:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recruiter not found."
            )

        if recruiter.is_blocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Blocked recruiters cannot activate jobs."
            )

        company = None

        if recruiter_profile.company_id:
            company = db.query(Company).filter(
                Company.id == recruiter_profile.company_id
            ).first()

        if company is None:
            company = db.query(Company).filter(
                Company.admin_user_id == recruiter.id
            ).first()

        if not company:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The recruiter's company could not be found."
            )

        if company.verification_status != "verified":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Jobs can only be activated for verified companies."
            )

    job.is_active = is_active

    db.commit()
    db.refresh(job)

    return {
        "message": (
            "Job activated successfully."
            if job.is_active
            else "Job deactivated successfully."
        ),
        "job_id": job.id,
        "title": job.title,
        "is_active": job.is_active,
        "moderation_status": job.moderation_status
    }


# --------------------------------------------------
# JOB REAPPROVAL REQUESTS — ADMIN REVIEW
# --------------------------------------------------

@router.get("/job-reapproval-requests")
def get_job_reapproval_requests(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Return job reapproval requests with job and recruiter details."""

    requests = (
        db.query(JobReapprovalRequest)
        .order_by(JobReapprovalRequest.created_at.desc())
        .all()
    )

    results = []

    for request in requests:
        job = db.query(Job).filter(
            Job.id == request.job_id
        ).first()

        recruiter_profile = db.query(RecruiterProfile).filter(
            RecruiterProfile.id == request.recruiter_id
        ).first()

        if not job or not recruiter_profile:
            continue

        recruiter = db.query(User).filter(
            User.id == recruiter_profile.user_id
        ).first()

        if not recruiter:
            continue

        company = None

        if recruiter_profile.company_id:
            company = db.query(Company).filter(
                Company.id == recruiter_profile.company_id
            ).first()

        if company is None:
            company = db.query(Company).filter(
                Company.admin_user_id == recruiter.id
            ).first()

        results.append({
            "id": request.id,
            "job_id": request.job_id,
            "recruiter_id": request.recruiter_id,
            "status": request.status,
            "recruiter_message": request.recruiter_message,
            "admin_notes": request.admin_notes,
            "created_at": request.created_at,
            "reviewed_at": request.reviewed_at,
            "reviewed_by": request.reviewed_by,

            "job": {
                "id": job.id,
                "title": job.title,
                "location": job.location,
                "job_type": job.job_type,
                "is_active": job.is_active,
                "moderation_status": job.moderation_status,
                "moderation_reason": job.moderation_reason,
            },

            "recruiter": {
                "id": recruiter.id,
                "name": recruiter.name,
                "email": recruiter.email,
                "is_blocked": recruiter.is_blocked,
                "blocked_reason": recruiter.blocked_reason,
            },

            "company": {
                "id": company.id,
                "name": company.name,
                "verification_status": company.verification_status,
            } if company else None,
        })

    return results


# --------------------------------------------------
# APPROVE OR REJECT JOB REAPPROVAL REQUEST
# --------------------------------------------------

@router.put("/job-reapproval-requests/{request_id}/review")
def review_job_reapproval_request(
    request_id: int,
    review_data: JobReapprovalReview,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Approve or reject a recruiter's job reapproval request."""

    request = (
        db.query(JobReapprovalRequest)
        .filter(JobReapprovalRequest.id == request_id)
        .with_for_update()
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job reapproval request not found.",
        )

    if request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reapproval request has already been reviewed.",
        )

    job = (
        db.query(Job)
        .filter(Job.id == request.job_id)
        .with_for_update()
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated job not found.",
        )

    if job.moderation_status != "pending_reapproval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job is not awaiting reapproval.",
        )

    recruiter_profile = db.query(RecruiterProfile).filter(
        RecruiterProfile.id == request.recruiter_id
    ).first()

    if not recruiter_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
        )

    recruiter = db.query(User).filter(
        User.id == recruiter_profile.user_id
    ).first()

    if not recruiter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter account not found.",
        )

    if review_data.status == "approved":

        if recruiter.is_blocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This recruiter is blocked. The job cannot be approved.",
            )

        company = None

        if recruiter_profile.company_id:
            company = db.query(Company).filter(
                Company.id == recruiter_profile.company_id
            ).first()

        if company is None:
            company = db.query(Company).filter(
                Company.admin_user_id == recruiter.id
            ).first()

        if not company:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The recruiter's company could not be found.",
            )

        if company.verification_status != "verified":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The recruiter's company is not verified.",
            )

        # Remove the moderation restriction.
        # Preserve job.is_active as it currently is.
        job.moderation_status = "normal"
        job.moderation_reason = None

        message = "Job reapproval request approved successfully."

    else:
        # Keep the job hidden after rejection.
        job.moderation_status = "hidden"

        message = "Job reapproval request rejected."

    request.status = review_data.status
    request.admin_notes = (
        review_data.admin_notes.strip()
        if review_data.admin_notes
        else None
    )
    request.reviewed_by = admin.id
    request.reviewed_at = datetime.utcnow()

    job.moderated_at = datetime.utcnow()
    job.moderated_by = admin.id

    db.commit()
    db.refresh(request)
    db.refresh(job)

    return {
        "message": message,
        "request_id": request.id,
        "job_id": job.id,
        "request_status": request.status,
        "moderation_status": job.moderation_status,
        "is_active": job.is_active,
        "admin_notes": request.admin_notes,
        "reviewed_at": request.reviewed_at,
    }


# --------------------------------------------------
# LIST ALL APPLICATIONS
# --------------------------------------------------

@router.get("/applications")
def get_all_applications(
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    application_status: str | None = None,
    is_archived: bool | None = None,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
):
    """Return applications for platform admin review."""

    if skip < 0 or limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pagination values.",
        )

    query = (
        db.query(
            Application,
            CandidateProfile,
            User,
            Job,
            RecruiterProfile,
            Company,
        )
        .join(
            CandidateProfile,
            Application.candidate_id == CandidateProfile.id,
        )
        .join(
            User,
            CandidateProfile.user_id == User.id,
        )
        .join(
            Job,
            Application.job_id == Job.id,
        )
        .join(
            RecruiterProfile,
            Job.recruiter_id == RecruiterProfile.id,
        )
        .outerjoin(
            Company,
            RecruiterProfile.company_id == Company.id,
        )
    )

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.name.ilike(search_term),
                User.email.ilike(search_term),
                Job.title.ilike(search_term),
                Company.name.ilike(search_term),
            )
        )

    if application_status:
        query = query.filter(
            Application.status == application_status
        )

    if is_archived is not None:
        query = query.filter(
            Application.is_archived == is_archived
        )

    total = query.count()

    results = (
        query
        .order_by(Application.applied_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    applications = []

    for application, candidate, candidate_user, job, recruiter, company in results:
        applications.append({
            "id": application.id,
            "status": application.status,
            "is_archived": application.is_archived,
            "applied_at": application.applied_at,
            "has_resume": application.has_resume,
            "candidate": {
                "id": candidate.id,
                "user_id": candidate_user.id,
                "name": candidate_user.name,
                "email": candidate_user.email,
            },
            "job": {
                "id": job.id,
                "title": job.title,
                "location": job.location,
                "job_type": job.job_type,
            },
            "recruiter": {
                "id": recruiter.id,
                "user_id": recruiter.user_id,
            },
            "company": {
                "id": company.id,
                "name": company.name,
            } if company else None,
        })

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "applications": applications,
    }


# --------------------------------------------------
# VIEW APPLICATION DETAILS
# --------------------------------------------------

@router.get("/applications/{application_id}")
def get_application_details(
    application_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
):
    """Return detailed application information for platform admin."""

    RecruiterUser = aliased(User)

    result = (
        db.query(
            Application,
            CandidateProfile,
            User,
            Job,
            RecruiterProfile,
            RecruiterUser,
            Company,
        )
        .join(
            CandidateProfile,
            Application.candidate_id == CandidateProfile.id,
        )
        .join(
            User,
            CandidateProfile.user_id == User.id,
        )
        .join(
            Job,
            Application.job_id == Job.id,
        )
        .join(
            RecruiterProfile,
            Job.recruiter_id == RecruiterProfile.id,
        )
        .join(
            RecruiterUser,
            RecruiterProfile.user_id == RecruiterUser.id,
        )
        .outerjoin(
            Company,
            RecruiterProfile.company_id == Company.id,
        )
        .filter(Application.id == application_id)
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )

    (
        application,
        candidate,
        candidate_user,
        job,
        recruiter,
        recruiter_user,
        company,
    ) = result

    return {
        "id": application.id,
        "status": application.status,
        "is_archived": application.is_archived,
        "applied_at": application.applied_at,
        "about_yourself": application.about_yourself,
        "has_resume": application.has_resume,
        "candidate": {
            "id": candidate.id,
            "user_id": candidate_user.id,
            "name": candidate_user.name,
            "email": candidate_user.email,
            "phone": candidate_user.phone,
            "location": candidate.location,
            "profile_resume_available": bool(candidate.resume),
        },
        "job": {
            "id": job.id,
            "title": job.title,
            "description": job.description,
            "location": job.location,
            "job_type": job.job_type,
            "is_active": job.is_active,
        },
        "recruiter": {
            "id": recruiter.id,
            "name": recruiter_user.name,
            "email": recruiter_user.email,
            "designation": recruiter.designation,
        },
        "company": {
            "id": company.id,
            "name": company.name,
            "location": company.location,
            "website": company.website,
        } if company else None,
    }


# --------------------------------------------------
# VIEW APPLICATION RESUME (PLATFORM ADMIN)
# --------------------------------------------------

@router.get("/applications/{application_id}/resume")
def view_application_resume(
    application_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
):
    """Allow platform admins to view the resume submitted with an application."""

    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )

    if not application.resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume was submitted with this application.",
        )

    file_path = get_stored_file(application.resume)

    media_type = (
        mimetypes.guess_type(file_path.name)[0]
        or "application/octet-stream"
    )

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=file_path.name,
        content_disposition_type="inline",
    )



# --------------------------------------------------
# BLOCK RECRUITER
# --------------------------------------------------

@router.put("/recruiters/{recruiter_id}/block")
def block_recruiter(
    recruiter_id: int,
    reason: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Block a recruiter from posting and displaying jobs."""

    recruiter = db.query(User).filter(
        User.id == recruiter_id,
        User.role == "recruiter"
    ).with_for_update().first()

    if not recruiter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found."
        )

    if recruiter.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recruiter is already blocked."
        )

    normalized_reason = reason.strip()

    if not normalized_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A blocking reason is required."
        )

    recruiter.is_blocked = True
    recruiter.blocked_reason = normalized_reason
    recruiter.blocked_at = datetime.utcnow()
    recruiter.blocked_by = admin.id

    db.commit()
    db.refresh(recruiter)

    return {
        "message": "Recruiter blocked successfully.",
        "recruiter_id": recruiter.id,
        "is_blocked": recruiter.is_blocked,
        "blocked_reason": recruiter.blocked_reason,
        "blocked_at": recruiter.blocked_at
    }


# --------------------------------------------------
# UNBLOCK RECRUITER
# --------------------------------------------------

@router.put("/recruiters/{recruiter_id}/unblock")
def unblock_recruiter(
    recruiter_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Restore a recruiter's ability to post jobs."""

    recruiter = db.query(User).filter(
        User.id == recruiter_id,
        User.role == "recruiter"
    ).with_for_update().first()

    if not recruiter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found."
        )

    if not recruiter.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recruiter is not currently blocked."
        )

    recruiter.is_blocked = False
    recruiter.blocked_reason = None
    recruiter.blocked_at = None
    recruiter.blocked_by = None

    db.commit()
    db.refresh(recruiter)

    return {
        "message": "Recruiter unblocked successfully.",
        "recruiter_id": recruiter.id,
        "is_blocked": recruiter.is_blocked
    }


# --------------------------------------------------
# HIDE OR PERMANENTLY DEACTIVATE JOB
# --------------------------------------------------

@router.put("/jobs/{job_id}/moderation")
def moderate_job(
    job_id: int,
    moderation_status: str = Body(...),
    reason: str = Body(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Temporarily hide or permanently deactivate a job.

    Supported statuses:
    - hidden
    - deactivated
    """

    if moderation_status not in {"hidden", "deactivated"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Moderation status must be hidden or deactivated."
        )

    normalized_reason = reason.strip()

    if not normalized_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A moderation reason is required."
        )

    job = db.query(Job).filter(
        Job.id == job_id
    ).with_for_update().first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found."
        )

    if job.moderation_status == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job has already been permanently deactivated."
        )

    job.moderation_status = moderation_status
    job.moderation_reason = normalized_reason
    job.moderated_at = datetime.utcnow()
    job.moderated_by = admin.id

    if moderation_status == "deactivated":
        job.is_active = False

    db.commit()
    db.refresh(job)

    return {
        "message": (
            "Job hidden successfully."
            if moderation_status == "hidden"
            else "Job permanently deactivated successfully."
        ),
        "job_id": job.id,
        "moderation_status": job.moderation_status,
        "moderation_reason": job.moderation_reason,
        "is_active": job.is_active,
        "moderated_at": job.moderated_at
    }
