
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user

from app.models.company import Company
from app.models.recruiter_profile import RecruiterProfile
from app.models.company_join_request import CompanyJoinRequest

from app.schemas.company import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
)

from app.schemas.company_join_request import (
    CompanyJoinRequestCreate,
    CompanyJoinRequestReview,
    CompanyJoinRequestResponse,
)


router = APIRouter(
    prefix="/companies",
    tags=["Company"]
)


def check_company_access(
    company_id: int,
    current_user,
    db: Session
):
    """Verify that the user is the company admin or an associated recruiter."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    is_admin = company.admin_user_id == current_user.id

    is_recruiter = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == current_user.id,
            RecruiterProfile.company_id == company_id
        )
        .first()
    )

    if not is_admin and not is_recruiter:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this company."
        )

    return company


# --------------------------------------------------
# CREATE COMPANY
# --------------------------------------------------

@router.post(
    "/",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED
)
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a company and assign its creator as company admin."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create a company."
        )

    # Prevent users already associated with a company from creating another.
    existing_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if existing_profile and existing_profile.company_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already associated with a company."
        )

    # Prevent duplicate company creation by an existing admin.
    existing_company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .first()
    )

    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already administer a company."
        )

    company = Company(
        admin_user_id=current_user.id,
        name=company_data.name,
        description=company_data.description,
        location=company_data.location,
        website=company_data.website
    )

    db.add(company)
    db.flush()

    # Associate an existing profile if one exists.
    if existing_profile:
        existing_profile.company_id = company.id

    db.commit()
    db.refresh(company)

    return company


# --------------------------------------------------
# GET COMPANY DETAILS
# --------------------------------------------------

@router.get(
    "/{company_id}",
    response_model=CompanyResponse
)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Retrieve company details for its admin or associated recruiters."""

    company = check_company_access(
        company_id,
        current_user,
        db
    )

    return company


# --------------------------------------------------
# UPDATE COMPANY DETAILS
# --------------------------------------------------

@router.put(
    "/{company_id}",
    response_model=CompanyResponse
)
def update_company(
    company_id: int,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Allow only the company admin to update company details."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    if company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can edit company details."
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
    status_code=status.HTTP_201_CREATED
)
def create_join_request(
    request_data: CompanyJoinRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Allow a recruiter user to request to join an existing company."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can request to join a company."
        )

    company = (
        db.query(Company)
        .filter(Company.id == request_data.company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    if company.admin_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already the admin of this company."
        )

    # A user can only be associated with one company.
    existing_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a recruiter profile."
        )

    # Prevent duplicate pending requests.
    existing_request = (
        db.query(CompanyJoinRequest)
        .filter(
            CompanyJoinRequest.recruiter_id == current_user.id,
            CompanyJoinRequest.company_id == company.id,
            CompanyJoinRequest.status == "pending"
        )
        .first()
    )

    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending request for this company."
        )

    join_request = CompanyJoinRequest(
        recruiter_id=current_user.id,
        company_id=company.id,
        status="pending"
    )

    db.add(join_request)
    db.commit()
    db.refresh(join_request)

    return join_request


# --------------------------------------------------
# VIEW COMPANY JOIN REQUESTS
# --------------------------------------------------

@router.get(
    "/join-requests/company/{company_id}",
    response_model=list[CompanyJoinRequestResponse]
)
def get_company_join_requests(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Allow the company admin to view requests for their company."""

    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    if company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can view join requests."
        )

    requests = (
        db.query(CompanyJoinRequest)
        .filter(
            CompanyJoinRequest.company_id == company_id
        )
        .order_by(CompanyJoinRequest.created_at.desc())
        .all()
    )

    return requests


# --------------------------------------------------
# REVIEW COMPANY JOIN REQUEST
# --------------------------------------------------

@router.put(
    "/join-requests/{request_id}",
    response_model=CompanyJoinRequestResponse
)
def review_join_request(
    request_id: int,
    review_data: CompanyJoinRequestReview,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Allow the company admin to approve or reject a join request."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company admins can review join requests."
        )

    if review_data.status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be approved or rejected."
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
            detail="Join request not found."
        )

    company = (
        db.query(Company)
        .filter(Company.id == join_request.company_id)
        .first()
    )

    if not company or company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the admin of this company can review this request."
        )

    if join_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request has already been reviewed."
        )

    if review_data.status == "approved":

        # Ensure the recruiter has not joined another company.
        existing_profile = (
            db.query(RecruiterProfile)
            .filter(
                RecruiterProfile.user_id == join_request.recruiter_id
            )
            .first()
        )

        if existing_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The recruiter already has a recruiter profile."
            )

    join_request.status = review_data.status
    join_request.reviewed_at = datetime.utcnow()
    join_request.reviewed_by_user_id = current_user.id

    db.commit()
    db.refresh(join_request)

    return join_request
