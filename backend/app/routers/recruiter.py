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
    # Only recruiters can create or complete recruiter profiles.
    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create recruiter profiles.",
        )

    # Find the company administered by this recruiter.
    company = (
        db.query(Company)
        .filter(Company.admin_user_id == current_user.id)
        .first()
    )

    # Otherwise, find the recruiter's latest approved join request.
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

    # Company association is mandatory.
    if not company:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You must create a company or get your "
                "company join request approved before "
                "creating a recruiter profile."
            ),
        )

    # Check whether a recruiter profile already exists.
    existing_profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.user_id == current_user.id
        )
        .first()
    )

    # Reuse an existing profile instead of creating a duplicate.
    if existing_profile:

        # Prevent accidental reassignment to another company.
        if (
            existing_profile.company_id is not None
            and existing_profile.company_id != company.id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already associated with another company.",
            )

        existing_profile.company_id = company.id
        existing_profile.designation = profile_data.designation

        db.commit()
        db.refresh(existing_profile)

        return existing_profile

    # Create a new profile only when one does not exist.
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

    # Update the authenticated recruiter's own details.
    current_user.name = profile_data.name
    profile.designation = profile_data.designation

    db.commit()
    db.refresh(profile)
    db.refresh(current_user)

    return profile