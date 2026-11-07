
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user

from app.models.company import Company
from app.models.recruiter_profile import RecruiterProfile
from app.models.company_join_request import CompanyJoinRequest
from app.models.user import User

from app.schemas.company import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
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

        # Reuse a legacy unassociated profile if one already exists.
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

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can access this endpoint.",
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

    return company


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

    company.name = company_data.name
    company.description = company_data.description
    company.location = company_data.location
    company.website = company_data.website

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

    # A recruiter who already belongs to a company cannot request another.
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

    # Do not allow another pending request for a different company either.
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

    # Do not allow reuse of an old approved request to join another company.
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
    """Return only pending join requests with recruiter details."""

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
        # Ensure the recruiter has not joined another company in the meantime.
        existing_admin_company = (
            db.query(Company)
            .filter(Company.admin_user_id == join_request.recruiter_id)
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

        # Reattach a legacy profile if one exists without a company.
        # New recruiters create their profile after approval.
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
    }


# --------------------------------------------------
# REMOVE SECONDARY RECRUITER FROM COMPANY
# --------------------------------------------------

@router.delete(
    "/{company_id}/recruiters/{user_id}",
)
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
