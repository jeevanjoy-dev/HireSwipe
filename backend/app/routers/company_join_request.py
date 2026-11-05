
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.company_join_request import CompanyJoinRequest
from app.models.recruiter_profile import RecruiterProfile
from app.schemas.company_join_request import (
    CompanyJoinRequestCreate,
    CompanyJoinRequestReview,
    CompanyJoinRequestResponse,
)


router = APIRouter(
    prefix="/companies/join-requests",
    tags=["Company Join Requests"]
)


@router.post(
    "/",
    response_model=CompanyJoinRequestResponse,
    status_code=status.HTTP_201_CREATED
)
def create_join_request(
    request_data: CompanyJoinRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Allow an unassociated recruiter to request company membership."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can request to join a company."
        )

    existing_profile = db.query(RecruiterProfile).filter(
        RecruiterProfile.user_id == current_user.id
    ).first()

    if existing_profile and existing_profile.company_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already associated with a company."
        )

    company = db.query(Company).filter(
        Company.id == request_data.company_id
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    existing_request = db.query(CompanyJoinRequest).filter(
        CompanyJoinRequest.recruiter_id == current_user.id,
        CompanyJoinRequest.company_id == request_data.company_id,
        CompanyJoinRequest.status == "pending"
    ).first()

    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending request for this company."
        )

    join_request = CompanyJoinRequest(
        recruiter_id=current_user.id,
        company_id=request_data.company_id,
        status="pending"
    )

    db.add(join_request)
    db.commit()
    db.refresh(join_request)

    return join_request


@router.get(
    "/my",
    response_model=list[CompanyJoinRequestResponse]
)
def get_my_join_requests(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Return join requests submitted by the authenticated recruiter."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can view their join requests."
        )

    return db.query(CompanyJoinRequest).filter(
        CompanyJoinRequest.recruiter_id == current_user.id
    ).order_by(CompanyJoinRequest.created_at.desc()).all()


@router.get(
    "/company/{company_id}",
    response_model=list[CompanyJoinRequestResponse]
)
def get_company_join_requests(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Allow only the company admin to view incoming requests."""

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

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

    return db.query(CompanyJoinRequest).filter(
        CompanyJoinRequest.company_id == company_id,
        CompanyJoinRequest.status == "pending"
    ).order_by(CompanyJoinRequest.created_at.desc()).all()


@router.put(
    "/{request_id}",
    response_model=CompanyJoinRequestResponse
)
def review_join_request(
    request_id: int,
    review_data: CompanyJoinRequestReview,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Allow the company admin to approve or reject a join request."""

    if review_data.status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be approved or rejected."
        )

    join_request = db.query(CompanyJoinRequest).filter(
        CompanyJoinRequest.id == request_id
    ).first()

    if not join_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found."
        )

    company = db.query(Company).filter(
        Company.id == join_request.company_id
    ).first()

    if not company or company.admin_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the company admin can review this request."
        )

    if join_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request has already been reviewed."
        )

    recruiter_profile = db.query(RecruiterProfile).filter(
        RecruiterProfile.user_id == join_request.recruiter_id
    ).first()

    if review_data.status == "approved":

        if recruiter_profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recruiter profile not found."
            )

        if recruiter_profile.company_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recruiter is already associated with a company."
            )

        recruiter_profile.company_id = company.id

    join_request.status = review_data.status
    join_request.reviewed_at = datetime.utcnow()
    join_request.reviewed_by_user_id = current_user.id

    db.commit()
    db.refresh(join_request)

    return join_request
