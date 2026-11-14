
import mimetypes
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_admin
from app.models.user import User
from app.models.company import Company
from app.models.job import Job
from app.models.application import Application
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

    pending_verifications = db.query(Company).filter(
        Company.verification_status == "pending_review"
    ).count()

    verified_companies = db.query(Company).filter(
        Company.verification_status == "verified"
    ).count()

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
    """Return all registered companies and verification details."""

    companies = db.query(Company).order_by(
        Company.id.desc()
    ).all()

    return [
        {
            "id": company.id,
            "name": company.name,
            "website": company.website,
            "business_email": company.business_email,
            "business_email_verified": company.business_email_verified,
            "domain_match": company_email_domain_matches(company),
            "business_phone": company.business_phone,
            "business_address": company.business_address,
            "document_1_uploaded": bool(company.document_1),
            "document_2_uploaded": bool(company.document_2),
            "documents_status": company.documents_status,
            "verification_status": company.verification_status
        }
        for company in companies
    ]


# --------------------------------------------------
# LIST PENDING COMPANIES
# --------------------------------------------------

@router.get("/companies/pending")
def get_pending_companies(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return companies awaiting platform-admin review."""

    companies = db.query(Company).filter(
        Company.verification_status == "pending_review"
    ).order_by(Company.id.asc()).all()

    return [
        {
            "id": company.id,
            "name": company.name,
            "website": company.website,
            "business_email": company.business_email,
            "business_email_verified": company.business_email_verified,
            "domain_match": company_email_domain_matches(company),
            "business_phone": company.business_phone,
            "business_address": company.business_address,
            "document_1_uploaded": bool(company.document_1),
            "document_2_uploaded": bool(company.document_2),
            "documents_status": company.documents_status,
            "verification_status": company.verification_status
        }
        for company in companies
    ]


# --------------------------------------------------
# VIEW COMPANY VERIFICATION DETAILS
# --------------------------------------------------

@router.get("/companies/{company_id}")
def get_company_verification_details(
    company_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Return detailed company information for admin review."""

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    return {
        "id": company.id,
        "name": company.name,
        "description": company.description,
        "website": company.website,
        "business_email": company.business_email,
        "business_email_verified": company.business_email_verified,
        "business_email_verified_at": company.business_email_verified_at,
        "website_domain": get_domain(company.website),
        "email_domain": (
            company.business_email.rsplit("@", 1)[-1].lower()
            if company.business_email else None
        ),
        "domain_match": company_email_domain_matches(company),
        "business_phone": company.business_phone,
        "business_address": company.business_address,
        "document_1_uploaded": bool(company.document_1),
        "document_2_uploaded": bool(company.document_2),
        "documents_status": company.documents_status,
        "verification_status": company.verification_status
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
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Allow platform admins to view submitted company documents."""

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

    storage_key = getattr(
        company,
        f"document_{document_number}"
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
        filename=file_path.name
    )


# --------------------------------------------------
# APPROVE COMPANY
# --------------------------------------------------

@router.put("/companies/{company_id}/approve")
def approve_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found"
        )

    # 1. Business email must be verified
    if not company.business_email_verified:
        raise HTTPException(
            status_code=400,
            detail="Business email must be verified first."
        )

    # 2. Business email domain must match website domain
    if not company_email_domain_matches(company):
        raise HTTPException(
            status_code=400,
            detail="Business email domain does not match the company website."
        )

    # 3. Business phone is required
    if not company.business_phone or not company.business_phone.strip():
        raise HTTPException(
            status_code=400,
            detail="Business phone number is required."
        )

    # 4. Business address is required
    if not company.business_address or not company.business_address.strip():
        raise HTTPException(
            status_code=400,
            detail="Business postal address is required."
        )

    # 5. Both verification documents must be uploaded
    if not company.document_1 or not company.document_2:
        raise HTTPException(
            status_code=400,
            detail="Both company verification documents must be uploaded."
        )

    # Approve company
    company.documents_status = "approved"
    company.verification_status = "verified"

    db.commit()
    db.refresh(company)

    return {
        "message": "Company verified successfully.",
        "company_id": company.id,
        "verification_status": company.verification_status,
        "documents_status": company.documents_status
    }

# --------------------------------------------------
# REJECT COMPANY
# --------------------------------------------------

@router.put("/companies/{company_id}/reject")
def reject_company(
    company_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Reject a company's verification submission."""

    company = db.query(Company).filter(
        Company.id == company_id
    ).with_for_update().first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    company.documents_status = "rejected"
    company.verification_status = "rejected"

    db.commit()
    db.refresh(company)

    return {
        "message": "Company verification rejected.",
        "company_id": company.id,
        "company_name": company.name,
        "documents_status": company.documents_status,
        "verification_status": company.verification_status
    }
