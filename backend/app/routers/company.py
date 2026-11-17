import os
from datetime import datetime
import mimetypes
import re
from urllib.parse import urlsplit

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user

from app.models.company import Company
from app.models.recruiter_profile import RecruiterProfile
from app.models.company_join_request import CompanyJoinRequest
from app.models.company_verification_request import CompanyVerificationRequest
from app.models.user import User

from app.services.file_storage import (
    save_upload,
    get_stored_file,
    delete_stored_file,
    ALLOWED_PHOTO_EXTENSIONS,
    MAX_PHOTO_SIZE,
)

from app.services.otp_service import (
    generate_otp,
    hash_otp,
    get_otp_expiry,
    verify_otp,
    MAX_OTP_ATTEMPTS,
    can_resend_otp,
)

from app.services.email_service import send_otp_email

from app.schemas.company import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyBusinessEmailRequest,
    CompanyBusinessEmailOTPVerifyRequest,
    CompanyBusinessPhoneRequest,
    CompanyBusinessPhoneOTPVerifyRequest,
)

from app.schemas.company_join_request import (
    CompanyJoinRequestCreate,
    CompanyJoinRequestReview,
    CompanyJoinRequestResponse,
    CompanyJoinRequestAdminResponse,
)

from app.schemas.recruiter import (
    CompanyRecruiterResponse,
    CompanyRecruiterUpdate,
)


router = APIRouter(
    prefix="/companies",
    tags=["Company"],
)

PHONE_OTP_MODE = os.getenv("PHONE_OTP_MODE", "disabled").lower()


# --------------------------------------------------
# COMPANY VERIFICATION SETTINGS
# --------------------------------------------------

ALLOWED_COMPANY_DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".jpg",
    ".jpeg",
    ".png",
}

MAX_COMPANY_DOCUMENT_SIZE = 5 * 1024 * 1024


# --------------------------------------------------
# COMPANY ACCESS CHECK
# --------------------------------------------------

def check_company_access(
    company_id: int,
    current_user,
    db: Session,
):
    """Check whether the current user belongs to the requested company."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    is_admin = company.admin_user_id == current_user.id

    is_recruiter = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == current_user.id,
            RecruiterProfile.company_id == company_id,
        )
        .first()
    )

    if not is_admin and not is_recruiter:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this company.",
        )

    return company


# --------------------------------------------------
# COMPANY VERIFICATION REQUEST HELPERS
# --------------------------------------------------

def get_latest_verification_request(
    company_id: int,
    db: Session,
    lock: bool = False,
):
    """Return the latest verification request for a company."""

    query = (
        db.query(CompanyVerificationRequest)
        .filter(
            CompanyVerificationRequest.company_id == company_id
        )
        .order_by(
            CompanyVerificationRequest.version_number.desc()
        )
    )

    if lock:
        query = query.with_for_update()

    return query.first()


def preserve_legacy_verification_documents(
    company: Company,
    db: Session,
):
    """
    Preserve older verification documents stored directly on Company.

    Creates a version 1 historical request when a company has legacy
    verification data but no CompanyVerificationRequest records.
    """

    existing_request = get_latest_verification_request(
        company.id,
        db,
    )

    if existing_request:
        return existing_request

    has_legacy_data = bool(
        company.document_1
        or company.document_2
        or company.verification_status in {
            "verified",
            "pending_review",
            "pending",
            "rejected",
            "inactive",
        }
    )

    if not has_legacy_data:
        return None

    if company.verification_status == "verified":
        legacy_status = "approved"

    elif company.verification_status in {
        "pending_review",
        "pending",
    }:
        legacy_status = "pending"

    elif company.verification_status in {
        "rejected",
        "inactive",
    }:
        legacy_status = "rejected"

    else:
        legacy_status = "draft"

    legacy_request = CompanyVerificationRequest(
        company_id=company.id,
        request_type="initial",
        version_number=1,
        document_1=company.document_1,
        document_2=company.document_2,
        status=legacy_status,
        submitted_at=(
            company.business_email_verified_at
            if legacy_status in {"approved", "pending"}
            else None
        ),
    )

    db.add(legacy_request)
    db.flush()

    return legacy_request


def get_next_verification_version(
    company_id: int,
    db: Session,
) -> int:
    """Calculate the next verification request version."""

    latest_request = get_latest_verification_request(
        company_id,
        db,
    )

    if not latest_request:
        return 1

    return latest_request.version_number + 1


def has_previously_approved_verification(
    company_id: int,
    db: Session,
) -> bool:
    """Check whether this company has ever passed verification."""

    return (
        db.query(CompanyVerificationRequest.id)
        .filter(
            CompanyVerificationRequest.company_id == company_id,
            CompanyVerificationRequest.status == "approved",
        )
        .first()
        is not None
    )


def get_or_create_draft_request(
    company: Company,
    db: Session,
):
    """
    Return an editable verification draft.

    First-time companies can automatically create their initial draft.

    Companies with an approved or rejected request must explicitly create
    a new verification request before uploading replacement documents.

    Pending requests cannot be modified.
    """

    preserve_legacy_verification_documents(
        company,
        db,
    )

    latest_request = get_latest_verification_request(
        company.id,
        db,
        lock=True,
    )

    if latest_request:

        if latest_request.status in {
            "pending",
            "pending_review",
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Your verification request is pending review. "
                    "Documents cannot be changed."
                ),
            )

        if latest_request.status == "draft":
            return latest_request

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Please create a new verification request before "
                "uploading documents."
            ),
        )

    # Only a company with no previous request can automatically
    # create its first initial draft.
    new_request = CompanyVerificationRequest(
        company_id=company.id,
        request_type="initial",
        version_number=1,
        status="draft",
    )

    db.add(new_request)
    db.flush()

    return new_request



def validate_company_verification_requirements(
    company: Company,
    verification_request: CompanyVerificationRequest,
):
    """Validate all requirements before submitting a request."""

    if not verification_request.document_1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload the first company verification document.",
        )

    if not verification_request.document_2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload the second company verification document.",
        )

    if not verification_request.business_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business email is required for this verification request.",
        )

    if not verification_request.business_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verify the business email for this verification request.",
        )

    if (
        company.business_email
        and company.business_email.lower()
        != verification_request.business_email.lower()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verified business email does not match the company's current business email.",
        )

    if not company.business_phone or not company.business_phone.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company business phone number is required.",
        )

    if not company.business_address or not company.business_address.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company business address is required.",
        )

    validate_company_email_domain(
        verification_request.business_email,
        company.website,
    )


def update_company_document_status(
    company: Company,
    verification_request: CompanyVerificationRequest | None,
):
    """
    Update document progress for the latest request.

    This function deliberately does not change verification_status.
    Uploading documents must not activate, deactivate, or overwrite
    the company's existing verification state.
    """

    if not verification_request:
        company.documents_status = "not_submitted"
        return

    has_first = bool(verification_request.document_1)
    has_second = bool(verification_request.document_2)

    if has_first and has_second:
        company.documents_status = "submitted"

    elif has_first or has_second:
        company.documents_status = "in_progress"

    else:
        company.documents_status = "not_submitted"


def ensure_company_admin(
    current_user,
    db: Session,
):
    """Return the company administered by the current recruiter."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company admins can access this endpoint.",
        )

    company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .with_for_update()
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You do not administer a company.",
        )

    return company


# --------------------------------------------------
# COMPANY BUSINESS EMAIL DOMAIN VALIDATION
# --------------------------------------------------

FREE_EMAIL_PROVIDERS = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.in",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "protonmail.com",
    "proton.me",
}


def get_website_domain(website: str) -> str:
    """Extract and normalize the host name from a company website."""

    normalized = website.strip().lower()

    if not normalized.startswith(("http://", "https://")):
        normalized = f"https://{normalized}"

    domain = urlsplit(normalized).hostname

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid company website.",
        )

    return domain.removeprefix("www.")


def validate_company_email_domain(
    business_email: str,
    website: str | None,
) -> None:
    """Require the business email domain to match the company website."""

    if not re.fullmatch(
        r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        business_email,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid business email address.",
        )

    email_domain = business_email.rsplit("@", 1)[1].lower()

    if email_domain in FREE_EMAIL_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please use your company's official domain email.",
        )

    if not website:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Add your company website before verifying "
                "your business email."
            ),
        )

    if email_domain != get_website_domain(website):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Your business email domain must match "
                "your company website domain."
            ),
        )


# --------------------------------------------------
# CREATE COMPANY
# --------------------------------------------------

@router.post(
    "/",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a company and assign its creator as Company Admin."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create a company.",
        )

    existing_company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .first()
    )

    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already administer a company.",
        )

    existing_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if existing_profile and existing_profile.company_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already associated with a company.",
        )

    company = Company(
        admin_user_id=current_user.id,
        name=company_data.name,
        description=company_data.description,
        location=company_data.location,
        website=company_data.website,
    )

    db.add(company)

    try:
        db.flush()

        if existing_profile:
            existing_profile.company_id = company.id

        db.commit()
        db.refresh(company)

    except Exception:
        db.rollback()
        raise

    return company


# --------------------------------------------------
# GET COMPANY LIST / SEARCH COMPANIES
# --------------------------------------------------

@router.get(
    "/",
    response_model=list[CompanyResponse],
)
def get_companies(
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Search existing companies for recruiter join requests."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can search companies.",
        )

    query = db.query(Company)

    if search:
        query = query.filter(
            Company.name.ilike(f"%{search}%")
        )

    return query.order_by(Company.name.asc()).limit(50).all()


# --------------------------------------------------
# GET COMPANY CREATED BY CURRENT RECRUITER
# --------------------------------------------------

@router.get(
    "/my-admin-company",
    response_model=CompanyResponse,
)
def get_my_admin_company(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the company administered by the current recruiter."""

    return ensure_company_admin(current_user, db)


# --------------------------------------------------
# GET COMPANY VERIFICATION STATUS
# --------------------------------------------------

@router.get("/my-admin-company/verification")
def get_my_company_verification_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the current company status and latest verification request."""

    company = ensure_company_admin(current_user, db)

    latest_request = preserve_legacy_verification_documents(
        company,
        db,
    )

    if latest_request:
        db.commit()
        db.refresh(latest_request)

    return {
        "company_id": company.id,
        "verification_status": company.verification_status,
        "documents_status": company.documents_status,
        "business_email": company.business_email,
        "business_email_verified": (
            latest_request.business_email_verified
            if latest_request
            else False
        ),
        "business_email_verified_at": (
            latest_request.business_email_verified_at
            if latest_request
            else None
        ),
        "business_phone": company.business_phone,
        "business_address": company.business_address,
        "approved_documents": {
            "document_1_uploaded": bool(company.document_1),
            "document_2_uploaded": bool(company.document_2),
        },
        "latest_request": (
            {
                "id": latest_request.id,
                "request_type": latest_request.request_type,
                "version_number": latest_request.version_number,
                "status": latest_request.status,
                "business_email": latest_request.business_email,
                "business_email_verified": latest_request.business_email_verified,
                "document_1_uploaded": bool(latest_request.document_1),
                "document_2_uploaded": bool(latest_request.document_2),
                "submitted_at": latest_request.submitted_at,
                "reviewed_at": latest_request.reviewed_at,
                "rejection_reason": latest_request.rejection_reason,
            }
            if latest_request
            else None
        ),
    }


# --------------------------------------------------
# REQUEST NEW VERIFICATION / RE-VERIFICATION
# --------------------------------------------------


@router.post("/my-admin-company/verification/request")
def request_new_company_verification(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new initial verification or re-verification request."""

    company = ensure_company_admin(current_user, db)

    preserve_legacy_verification_documents(company, db)

    latest_request = get_latest_verification_request(
        company.id,
        db,
        lock=True,
    )

    if latest_request and latest_request.status in {
        "pending",
        "pending_review",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A verification request is already pending review.",
        )

    # Reuse an existing draft without resetting its OTP state.
    if latest_request and latest_request.status == "draft":
        return {
            "message": "You already have an editable verification request.",
            "request_id": latest_request.id,
            "request_type": latest_request.request_type,
            "version_number": latest_request.version_number,
            "request_status": latest_request.status,
            "business_email_verified": latest_request.business_email_verified,
        }

    previously_approved = has_previously_approved_verification(
        company.id,
        db,
    )

    request_type = "updated" if previously_approved else "initial"

    next_version = (
        latest_request.version_number + 1
        if latest_request
        else 1
    )

    new_request = CompanyVerificationRequest(
        company_id=company.id,
        request_type=request_type,
        version_number=next_version,
        status="draft",
        document_1=None,
        document_2=None,
        business_email=company.business_email,
        business_email_verified=False,
        business_email_verified_at=None,
        business_email_otp_hash=None,
        business_email_otp_expires_at=None,
        business_email_otp_attempts=0,
        business_email_otp_last_sent_at=None,
    )

    # Keep legacy company-level verification fields synchronized.
    # Actual submission validation uses the request-level fields.
    company.business_email_verified = False
    company.business_email_verified_at = None
    company.business_email_otp_hash = None
    company.business_email_otp_expires_at = None
    company.business_email_otp_attempts = 0
    company.business_email_otp_last_sent_at = None

    db.add(new_request)

    try:
        db.commit()
        db.refresh(new_request)
        db.refresh(company)

    except Exception:
        db.rollback()
        raise

    return {
        "message": "New verification request created successfully.",
        "request_id": new_request.id,
        "request_type": new_request.request_type,
        "version_number": new_request.version_number,
        "request_status": new_request.status,
        "business_email_verified": False,
    }


# --------------------------------------------------
# SUBMIT COMPANY VERIFICATION REQUEST
# --------------------------------------------------

@router.post("/my-admin-company/verification/submit")
def submit_company_verification_request(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Submit the latest draft for platform admin review."""

    company = ensure_company_admin(
        current_user,
        db,
    )

    preserve_legacy_verification_documents(
        company,
        db,
    )

    verification_request = get_latest_verification_request(
        company.id,
        db,
        lock=True,
    )

    if not verification_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please create a verification request first.",
        )

    if verification_request.status in {
        "pending",
        "pending_review",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification request has already been submitted.",
        )

    if verification_request.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only a draft verification request can be submitted. "
                "Create a new request first."
            ),
        )

    validate_company_verification_requirements(
        company,
        verification_request,
    )

    verification_request.status = "pending"
    verification_request.submitted_at = datetime.utcnow()

    company.documents_status = "submitted"

    # Preserve the previous company state during re-verification.
    # A previously verified company remains verified while pending.
    # A previously inactive company remains inactive while pending.
    # An initially unverified company moves to pending_review.
    if (
        verification_request.request_type == "initial"
        and company.verification_status == "unverified"
    ):
        company.verification_status = "pending_review"

    try:
        db.commit()
        db.refresh(verification_request)
        db.refresh(company)

    except Exception:
        db.rollback()
        raise

    return {
        "message": "Company verification request submitted successfully.",
        "request_id": verification_request.id,
        "request_type": verification_request.request_type,
        "version_number": verification_request.version_number,
        "request_status": verification_request.status,
        "verification_status": company.verification_status,
        "documents_status": company.documents_status,
    }


# --------------------------------------------------
# SEND COMPANY BUSINESS EMAIL OTP
# --------------------------------------------------


@router.post("/my-admin-company/business-email/send-otp")
def send_company_business_email_otp(
    request_data: CompanyBusinessEmailRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Send an OTP for the latest draft verification request."""

    company = ensure_company_admin(current_user, db)

    verification_request = get_latest_verification_request(
        company.id,
        db,
        lock=True,
    )

    if not verification_request or verification_request.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Create a new verification request before verifying your business email.",
        )

    business_email = request_data.business_email.strip().lower()

    validate_company_email_domain(
        business_email,
        company.website,
    )

    duplicate = (
        db.query(Company)
        .filter(
            Company.business_email == business_email,
            Company.id != company.id,
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This business email is already associated with another company.",
        )

    if (
        verification_request.business_email == business_email
        and verification_request.business_email_verified
    ):
        return {
            "message": "This business email is already verified for this request.",
            "business_email": business_email,
            "business_email_verified": True,
        }

    if not can_resend_otp(
        verification_request.business_email_otp_last_sent_at
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another OTP.",
        )

    otp = generate_otp()

    verification_request.business_email = business_email
    verification_request.business_email_verified = False
    verification_request.business_email_verified_at = None
    verification_request.business_email_otp_hash = hash_otp(otp)
    verification_request.business_email_otp_expires_at = get_otp_expiry()
    verification_request.business_email_otp_attempts = 0
    verification_request.business_email_otp_last_sent_at = datetime.utcnow()

    # Keep the company's current contact email synchronized.
    company.business_email = business_email
    company.business_email_verified = False
    company.business_email_verified_at = None

    try:
        send_otp_email(
            recipient_email=business_email,
            otp=otp,
            purpose="company_verification",
        )

        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send company verification email. Please try again.",
        ) from exc

    return {
        "message": "Company verification OTP sent successfully.",
        "business_email": business_email,
        "business_email_verified": False,
        "request_id": verification_request.id,
    }


# --------------------------------------------------
# VERIFY COMPANY BUSINESS EMAIL OTP
# --------------------------------------------------


@router.post("/my-admin-company/business-email/verify-otp")
def verify_company_business_email_otp(
    request_data: CompanyBusinessEmailOTPVerifyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Verify the OTP for the latest draft verification request."""

    company = ensure_company_admin(current_user, db)

    verification_request = get_latest_verification_request(
        company.id,
        db,
        lock=True,
    )

    if not verification_request or verification_request.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Create a new verification request before verifying your business email.",
        )

    if verification_request.business_email_verified:
        return {
            "message": "Company business email is already verified for this request.",
            "business_email": verification_request.business_email,
            "business_email_verified": True,
            "request_id": verification_request.id,
        }

    if (
        not verification_request.business_email
        or not verification_request.business_email_otp_hash
        or not verification_request.business_email_otp_expires_at
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please request a company verification OTP first.",
        )

    if datetime.utcnow() > verification_request.business_email_otp_expires_at:
        verification_request.business_email_otp_hash = None
        verification_request.business_email_otp_expires_at = None
        verification_request.business_email_otp_attempts = 0

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP.",
        )

    if (
        verification_request.business_email_otp_attempts
        >= MAX_OTP_ATTEMPTS
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum OTP attempts exceeded. Request a new OTP.",
        )

    if not verify_otp(
        request_data.otp,
        verification_request.business_email_otp_hash,
    ):
        verification_request.business_email_otp_attempts += 1
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP.",
        )

    verification_request.business_email_verified = True
    verification_request.business_email_verified_at = datetime.utcnow()
    verification_request.business_email_otp_hash = None
    verification_request.business_email_otp_expires_at = None
    verification_request.business_email_otp_attempts = 0

    # Maintain the legacy company-level status for compatibility.
    company.business_email_verified = True
    company.business_email_verified_at = datetime.utcnow()

    db.commit()

    db.refresh(verification_request)
    db.refresh(company)

    return {
        "message": "Company business email verified successfully.",
        "business_email": verification_request.business_email,
        "business_email_verified": True,
        "request_id": verification_request.id,
    }


# --------------------------------------------------
# SEND COMPANY BUSINESS PHONE OTP
# --------------------------------------------------

@router.post("/my-admin-company/business-phone/send-otp")
def send_company_business_phone_otp(
    request_data: CompanyBusinessPhoneRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Generate a mock OTP for the company's business phone."""

    company = ensure_company_admin(current_user, db)

    # Allow mock OTP only when configured in the environment.
    if PHONE_OTP_MODE != "mock":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Phone OTP mock mode is disabled.",
        )

    business_phone = request_data.business_phone.strip()

    # Return immediately if this number is already verified.
    if (
        company.business_phone == business_phone
        and company.business_phone_verified
    ):
        return {
            "message": "This business phone number is already verified.",
            "business_phone": business_phone,
            "business_phone_verified": True,
        }

    # Prevent frequent OTP requests.
    if not can_resend_otp(
        company.business_phone_otp_last_sent_at
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another OTP.",
        )

    otp = generate_otp()

    # Save the new phone number and OTP information.
    company.business_phone = business_phone
    company.business_phone_verified = False
    company.business_phone_verified_at = None

    company.business_phone_otp_hash = hash_otp(otp)
    company.business_phone_otp_expires_at = get_otp_expiry()
    company.business_phone_otp_attempts = 0
    company.business_phone_otp_last_sent_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(company)

    except Exception:
        db.rollback()
        raise

    return {
        "message": "Mock OTP generated successfully.",
        "business_phone": company.business_phone,
        "business_phone_verified": False,
        "mock_otp": otp,
    }


# --------------------------------------------------
# VERIFY COMPANY BUSINESS PHONE MOCK OTP
# --------------------------------------------------

@router.post("/my-admin-company/business-phone/verify-otp")
def verify_company_business_phone_otp(
    request_data: CompanyBusinessPhoneOTPVerifyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Verify the mock OTP for the company's business phone."""

    company = ensure_company_admin(current_user, db)

    if company.business_phone_verified:
        return {
            "message": "Company business phone is already verified.",
            "business_phone": company.business_phone,
            "business_phone_verified": True,
        }

    if (
        not company.business_phone
        or not company.business_phone_otp_hash
        or not company.business_phone_otp_expires_at
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please generate a phone OTP first.",
        )

    # Check OTP expiry.
    if datetime.utcnow() > company.business_phone_otp_expires_at:
        company.business_phone_otp_hash = None
        company.business_phone_otp_expires_at = None
        company.business_phone_otp_attempts = 0

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP.",
        )

    # Check maximum attempts.
    if company.business_phone_otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum OTP attempts exceeded. Request a new OTP.",
        )

    # Verify OTP.
    if not verify_otp(
        request_data.otp,
        company.business_phone_otp_hash,
    ):
        company.business_phone_otp_attempts += 1
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP.",
        )

    # Mark phone number as verified.
    company.business_phone_verified = True
    company.business_phone_verified_at = datetime.utcnow()

    # Clear OTP data after successful verification.
    company.business_phone_otp_hash = None
    company.business_phone_otp_expires_at = None
    company.business_phone_otp_attempts = 0

    try:
        db.commit()
        db.refresh(company)

    except Exception:
        db.rollback()
        raise

    return {
        "message": "Company business phone verified successfully.",
        "business_phone": company.business_phone,
        "business_phone_verified": True,
    }


# --------------------------------------------------
# UPLOAD COMPANY VERIFICATION DOCUMENT
# --------------------------------------------------

@router.post("/my-admin-company/documents/{document_number}")
async def upload_company_verification_document(
    document_number: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload a document to the current editable draft request."""

    if document_number not in (1, 2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document number must be 1 or 2.",
        )

    company = ensure_company_admin(
        current_user,
        db,
    )

    verification_request = get_or_create_draft_request(
        company,
        db,
    )

    field_name = f"document_{document_number}"
    new_key = None

    try:
        new_key = await save_upload(
            upload=file,
            category="company_verification_documents",
            allowed_extensions=ALLOWED_COMPANY_DOCUMENT_EXTENSIONS,
            max_size=MAX_COMPANY_DOCUMENT_SIZE,
        )

        setattr(
            verification_request,
            field_name,
            new_key,
        )

        update_company_document_status(
            company,
            verification_request,
        )

        db.commit()
        db.refresh(verification_request)
        db.refresh(company)

    except Exception:
        db.rollback()

        if new_key:
            delete_stored_file(new_key)

        raise

    finally:
        await file.close()

    # Do not delete the previous stored file here.
    # Historical verification requests must retain their documents.

    return {
        "message": (
            f"Company verification document {document_number} "
            "uploaded successfully."
        ),
        "document_number": document_number,
        "request_id": verification_request.id,
        "request_type": verification_request.request_type,
        "version_number": verification_request.version_number,
        "request_status": verification_request.status,
        "documents_status": company.documents_status,
        "verification_status": company.verification_status,
    }


# --------------------------------------------------
# VIEW COMPANY VERIFICATION DOCUMENT
# --------------------------------------------------

@router.get("/my-admin-company/documents/{document_number}")
def get_company_verification_document(
    document_number: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """View the latest request's document or the current approved document."""

    if document_number not in (1, 2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document number must be 1 or 2.",
        )

    company = ensure_company_admin(
        current_user,
        db,
    )

    latest_request = preserve_legacy_verification_documents(
        company,
        db,
    )

    storage_key = None

    if latest_request:
        storage_key = getattr(
            latest_request,
            f"document_{document_number}",
        )

    # If the latest request does not contain this document,
    # fall back to the company's current approved document.
    if not storage_key:
        storage_key = getattr(
            company,
            f"document_{document_number}",
        )

    if not storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Company verification document "
                f"{document_number} not found."
            ),
        )

    db.commit()

    file_path = get_stored_file(storage_key)

    media_type = (
        mimetypes.guess_type(file_path.name)[0]
        or "application/octet-stream"
    )

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=file_path.name,
    )


# --------------------------------------------------
# UPLOAD / REPLACE COMPANY ADMIN PROFILE PHOTO
# --------------------------------------------------

@router.post(
    "/my-admin-company/photo",
    response_model=CompanyResponse,
)
async def upload_company_admin_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload or replace the company admin's profile photo."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company admins can upload profile photos.",
        )

    company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You do not administer a company.",
        )

    new_photo_key = None
    old_photo_key = company.admin_profile_photo

    try:
        new_photo_key = await save_upload(
            upload=file,
            category="company_admin_profile_photos",
            allowed_extensions=ALLOWED_PHOTO_EXTENSIONS,
            max_size=MAX_PHOTO_SIZE,
        )

        company.admin_profile_photo = new_photo_key

        db.commit()
        db.refresh(company)

    except Exception:
        db.rollback()

        if new_photo_key:
            delete_stored_file(new_photo_key)

        raise

    finally:
        await file.close()

    if old_photo_key:
        delete_stored_file(old_photo_key)

    return company


# --------------------------------------------------
# GET COMPANY ADMIN PROFILE PHOTO
# --------------------------------------------------

@router.get("/my-admin-company/photo")
def get_company_admin_photo(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the company admin's profile photo."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company admins can access this photo.",
        )

    company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .first()
    )

    if not company or not company.admin_profile_photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company admin profile photo not found.",
        )

    file_path = get_stored_file(company.admin_profile_photo)

    return FileResponse(file_path)


# --------------------------------------------------
# DELETE COMPANY ADMIN PROFILE PHOTO
# --------------------------------------------------

@router.delete(
    "/my-admin-company/photo",
    response_model=CompanyResponse,
)
def delete_company_admin_photo(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete the company admin's profile photo."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company admins can delete profile photos.",
        )

    company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You do not administer a company.",
        )

    old_photo_key = company.admin_profile_photo

    if not old_photo_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No company admin profile photo to delete.",
        )

    company.admin_profile_photo = None

    db.commit()
    db.refresh(company)

    delete_stored_file(old_photo_key)

    return company



# --------------------------------------------------
# UPLOAD / REPLACE COMPANY LOGO
# --------------------------------------------------

@router.post("/my-admin-company/logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow only the Company Admin to upload or replace the company logo."""

    company = ensure_company_admin(current_user, db)

    new_logo_key = None
    old_logo_key = company.logo

    try:
        new_logo_key = await save_upload(
            upload=file,
            category="company_logos",
            allowed_extensions=ALLOWED_PHOTO_EXTENSIONS,
            max_size=MAX_PHOTO_SIZE,
        )

        company.logo = new_logo_key

        db.commit()
        db.refresh(company)

    except Exception:
        db.rollback()

        if new_logo_key:
            delete_stored_file(new_logo_key)

        raise

    finally:
        await file.close()

    # Delete the previous logo only after the new one is saved.
    if old_logo_key:
        delete_stored_file(old_logo_key)

    return {
        "message": "Company logo uploaded successfully.",
        "company_id": company.id,
        "logo_uploaded": True,
    }


# --------------------------------------------------
# VIEW COMPANY LOGO
# --------------------------------------------------

@router.get("/{company_id}/logo")
def get_company_logo(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow the company admin and associated recruiters to view the logo."""

    company = check_company_access(
        company_id,
        current_user,
        db,
    )

    if not company.logo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company logo not found.",
        )

    file_path = get_stored_file(company.logo)

    media_type = (
        mimetypes.guess_type(file_path.name)[0]
        or "application/octet-stream"
    )

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=file_path.name,
    )


# --------------------------------------------------
# DELETE COMPANY LOGO
# --------------------------------------------------

@router.delete("/my-admin-company/logo")
def delete_company_logo(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow only the Company Admin to delete the company logo."""

    company = ensure_company_admin(current_user, db)

    old_logo_key = company.logo

    if not old_logo_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No company logo to delete.",
        )

    company.logo = None

    try:
        db.commit()
        db.refresh(company)

    except Exception:
        db.rollback()
        raise

    delete_stored_file(old_logo_key)

    return {
        "message": "Company logo deleted successfully.",
        "company_id": company.id,
        "logo_uploaded": False,
    }



# --------------------------------------------------
# GET COMPANY DETAILS
# --------------------------------------------------

@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return company details to its admin or associated recruiters."""

    return check_company_access(
        company_id,
        current_user,
        db,
    )


# --------------------------------------------------
# UPDATE COMPANY DETAILS
# --------------------------------------------------

@router.put(
    "/{company_id}",
    response_model=CompanyResponse,
)
def update_company(
    company_id: int,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow only the Company Admin to update company details."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .with_for_update()
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    if company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can edit company details.",
        )

    latest_request = get_latest_verification_request(
        company.id,
        db,
    )

    if latest_request and latest_request.status in {
        "pending",
        "pending_review",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Company details cannot be changed while a verification "
                "request is pending review."
            ),
        )

    old_website_domain = (
        get_website_domain(company.website)
        if company.website
        else None
    )

    new_website_domain = (
        get_website_domain(company_data.website)
        if company_data.website
        else None
    )

    company.name = company_data.name
    company.description = company_data.description
    company.location = company_data.location
    company.website = company_data.website
    company.business_phone = company_data.business_phone
    company.business_address = company_data.business_address

    if old_website_domain != new_website_domain:
        company.business_email_verified = False
        company.business_email_verified_at = None
        company.business_email_otp_hash = None
        company.business_email_otp_expires_at = None
        company.business_email_otp_attempts = 0
        company.business_email_otp_last_sent_at = None

    db.commit()
    db.refresh(company)

    return company


# --------------------------------------------------
# CREATE COMPANY JOIN REQUEST
# --------------------------------------------------

@router.post(
    "/join-requests",
    response_model=CompanyJoinRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_join_request(
    request_data: CompanyJoinRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow an unassociated recruiter to request company membership."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can request to join a company.",
        )

    company = (
        db.query(Company)
        .filter(Company.id == request_data.company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    if company.admin_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already the admin of this company.",
        )

    existing_profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == current_user.id,
            RecruiterProfile.company_id.isnot(None),
        )
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already associated with a company.",
        )

    existing_admin_company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .first()
    )

    if existing_admin_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already administer a company.",
        )

    existing_request = (
        db.query(CompanyJoinRequest)
        .filter(
            CompanyJoinRequest.recruiter_id == current_user.id,
            CompanyJoinRequest.status == "pending",
        )
        .first()
    )

    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending company join request.",
        )

    approved_request = (
        db.query(CompanyJoinRequest)
        .filter(
            CompanyJoinRequest.recruiter_id == current_user.id,
            CompanyJoinRequest.status == "approved",
        )
        .first()
    )

    if approved_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an approved company association.",
        )

    join_request = CompanyJoinRequest(
        recruiter_id=current_user.id,
        company_id=company.id,
        status="pending",
    )

    db.add(join_request)
    db.commit()
    db.refresh(join_request)

    return join_request


# --------------------------------------------------
# GET JOIN REQUESTS OF CURRENT RECRUITER
# --------------------------------------------------

@router.get(
    "/join-requests/me",
    response_model=list[CompanyJoinRequestResponse],
)
def get_my_join_requests(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return all join requests submitted by the current recruiter."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can view join requests.",
        )

    requests = (
        db.query(CompanyJoinRequest)
        .filter(
            CompanyJoinRequest.recruiter_id == current_user.id
        )
        .order_by(CompanyJoinRequest.created_at.desc())
        .all()
    )

    return requests


# --------------------------------------------------
# VIEW COMPANY JOIN REQUESTS (COMPANY ADMIN)
# --------------------------------------------------

@router.get(
    "/join-requests/company/{company_id}",
    response_model=list[CompanyJoinRequestAdminResponse],
)
def get_company_join_requests(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return pending join requests with recruiter details."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    if company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can view join requests.",
        )

    requests = (
        db.query(CompanyJoinRequest, User)
        .join(
            User,
            User.id == CompanyJoinRequest.recruiter_id,
        )
        .filter(
            CompanyJoinRequest.company_id == company_id,
            CompanyJoinRequest.status == "pending",
        )
        .order_by(CompanyJoinRequest.created_at.desc())
        .all()
    )

    return [
        {
            "id": request.id,
            "recruiter_id": request.recruiter_id,
            "company_id": request.company_id,
            "status": request.status,
            "created_at": request.created_at,
            "reviewed_at": request.reviewed_at,
            "reviewed_by_user_id": request.reviewed_by_user_id,
            "recruiter_name": recruiter.name,
            "recruiter_email": recruiter.email,
        }
        for request, recruiter in requests
    ]


# --------------------------------------------------
# APPROVE / REJECT COMPANY JOIN REQUEST
# --------------------------------------------------

@router.put(
    "/join-requests/{request_id}",
    response_model=CompanyJoinRequestResponse,
)
def review_join_request(
    request_id: int,
    review_data: CompanyJoinRequestReview,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow the Company Admin to approve or reject a join request."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company admins can review join requests.",
        )

    if review_data.status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be approved or rejected.",
        )

    join_request = (
        db.query(CompanyJoinRequest)
        .filter(CompanyJoinRequest.id == request_id)
        .with_for_update()
        .first()
    )

    if not join_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found.",
        )

    company = (
        db.query(Company)
        .filter(Company.id == join_request.company_id)
        .first()
    )

    if not company or company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the admin of this company can review this request.",
        )

    if join_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request has already been reviewed.",
        )

    if review_data.status == "approved":
        existing_admin_company = (
            db.query(Company)
            .filter(
                Company.admin_user_id == join_request.recruiter_id
            )
            .first()
        )

        existing_profile = (
            db.query(RecruiterProfile)
            .filter(
                RecruiterProfile.user_id == join_request.recruiter_id
            )
            .first()
        )

        if existing_admin_company:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The recruiter already administers a company.",
            )

        if existing_profile and existing_profile.company_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The recruiter is already associated with a company.",
            )

        if existing_profile:
            existing_profile.company_id = company.id

    join_request.status = review_data.status
    join_request.reviewed_at = datetime.utcnow()
    join_request.reviewed_by_user_id = current_user.id

    db.commit()
    db.refresh(join_request)

    return join_request


# --------------------------------------------------
# VIEW SECONDARY RECRUITERS (COMPANY ADMIN)
# --------------------------------------------------

@router.get(
    "/{company_id}/recruiters",
    response_model=list[CompanyRecruiterResponse],
)
def get_company_recruiters(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return all secondary recruiters belonging to the company."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    if company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can manage recruiters.",
        )

    recruiters = (
        db.query(RecruiterProfile, User)
        .join(User, RecruiterProfile.user_id == User.id)
        .filter(
            RecruiterProfile.company_id == company_id,
            RecruiterProfile.user_id != company.admin_user_id,
        )
        .all()
    )

    return [
        {
            "id": profile.id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "designation": profile.designation,
            "profile_photo": profile.profile_photo,
        }
        for profile, user in recruiters
    ]


# --------------------------------------------------
# UPDATE SECONDARY RECRUITER (COMPANY ADMIN)
# --------------------------------------------------

@router.put(
    "/{company_id}/recruiters/{user_id}",
    response_model=CompanyRecruiterResponse,
)
def update_company_recruiter(
    company_id: int,
    user_id: int,
    recruiter_data: CompanyRecruiterUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow the Company Admin to update a secondary recruiter."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    if company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can edit recruiters.",
        )

    if user_id == company.admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use your own recruiter profile to update your details.",
        )

    profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == user_id,
            RecruiterProfile.company_id == company_id,
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found in this company.",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    existing_email = (
        db.query(User)
        .filter(
            User.email == recruiter_data.email,
            User.id != user_id,
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already registered.",
        )

    user.name = recruiter_data.name
    user.email = recruiter_data.email
    profile.designation = recruiter_data.designation

    db.commit()
    db.refresh(user)
    db.refresh(profile)

    return {
        "id": profile.id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "designation": profile.designation,
        "profile_photo": profile.profile_photo,
    }


# --------------------------------------------------
# REMOVE SECONDARY RECRUITER FROM COMPANY
# --------------------------------------------------

@router.delete("/{company_id}/recruiters/{user_id}")
def remove_company_recruiter(
    company_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Unlink a secondary recruiter without deleting their account."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    if company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can remove recruiters.",
        )

    if user_id == company.admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The Company Admin cannot remove themselves.",
        )

    profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == user_id,
            RecruiterProfile.company_id == company_id,
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter not found in this company.",
        )

    # Preserve the recruiter's account and historical job records.
    profile.company_id = None

    db.commit()

    return {
        "message": "Recruiter successfully removed from the company."
    }
