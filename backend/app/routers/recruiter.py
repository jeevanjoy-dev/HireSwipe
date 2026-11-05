
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user

from app.models.recruiter_profile import RecruiterProfile
from app.models.company import Company
from app.models.company_join_request import CompanyJoinRequest

from app.schemas.recruiter import (
    RecruiterProfileCreate,
    RecruiterProfileUpdate,
    RecruiterProfileResponse,
)


router = APIRouter(
    prefix="/recruiter",
    tags=["Recruiter"],
)


# --------------------------------------------------
# CREATE RECRUITER PROFILE
# --------------------------------------------------

@router.post(
    "/profile",
    response_model=RecruiterProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_recruiter_profile(
    profile_data: RecruiterProfileCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    # Only recruiters can create recruiter profiles
    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create recruiter profiles.",
        )

    # Check whether profile already exists
    existing_profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == current_user.id
        )
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recruiter profile already exists.",
        )

    company = None

    # CASE 1: Recruiter is the Company Admin
    company = (
        db.query(Company)
        .filter(
            Company.admin_user_id == current_user.id
        )
        .first()
    )

    # CASE 2: Recruiter joined an existing company
    if not company:

        approved_request = (
            db.query(CompanyJoinRequest)
            .filter(
                CompanyJoinRequest.recruiter_id == current_user.id,
                CompanyJoinRequest.status == "approved",
            )
            .order_by(
                CompanyJoinRequest.reviewed_at.desc()
            )
            .first()
        )

        if approved_request:
            company = (
                db.query(Company)
                .filter(
                    Company.id == approved_request.company_id
                )
                .first()
            )

    # Reject if no company association exists
    if not company:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You must create a company or get your "
                "company join request approved before "
                "creating a recruiter profile."
            ),
        )

    # Create recruiter profile
    new_profile = RecruiterProfile(
        user_id=current_user.id,
        company_id=company.id,
        designation=profile_data.designation,
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return new_profile


# --------------------------------------------------
# GET RECRUITER PROFILE
# --------------------------------------------------

@router.get(
    "/profile",
    response_model=RecruiterProfileResponse,
)
def get_recruiter_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can access recruiter profiles.",
        )

    profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == current_user.id
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
        )

    return profile


# --------------------------------------------------
# UPDATE RECRUITER PROFILE
# --------------------------------------------------

@router.put(
    "/profile",
    response_model=RecruiterProfileResponse,
)
def update_recruiter_profile(
    profile_data: RecruiterProfileUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can update recruiter profiles.",
        )

    profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == current_user.id
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
        )

    # Recruiters can update only their designation
    profile.designation = profile_data.designation

    db.commit()
    db.refresh(profile)

    return profile
