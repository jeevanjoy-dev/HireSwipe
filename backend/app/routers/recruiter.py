from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.recruiter_profile import RecruiterProfile
from app.models.company import Company
from app.schemas.recruiter import (
    RecruiterProfileCreate,
    RecruiterProfileResponse,
)

router = APIRouter(
    prefix="/recruiter",
    tags=["Recruiter"]
)


@router.post(
    "/profile",
    response_model=RecruiterProfileResponse
)
def create_recruiter_profile(
    profile_data: RecruiterProfileCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a recruiter profile for the authenticated recruiter.

    Args:
        profile_data: Recruiter profile information.
        db: Database session.
        current_user: Currently authenticated user.

    Returns:
        RecruiterProfile: The newly created recruiter profile.

    Raises:
        HTTPException: If the user is not a recruiter, the company
            does not exist, or a profile already exists.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create a recruiter profile."
        )

    existing_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recruiter profile already exists."
        )

    company = (
        db.query(Company)
        .filter(Company.id == profile_data.company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    new_profile = RecruiterProfile(
        user_id=current_user.id,
        company_id=profile_data.company_id,
        designation=profile_data.designation
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return new_profile

@router.get(
    "/profile",
    response_model=RecruiterProfileResponse
)
def get_recruiter_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get the recruiter profile of the authenticated recruiter.

    Args:
        db: Database session used to access PostgreSQL.
        current_user: Authenticated user requesting the profile.

    Returns:
        The recruiter profile belonging to the authenticated user.

    Raises:
        HTTPException: If the user is not a recruiter or the profile does not exist.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can access a recruiter profile."
        )

    profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found."
        )

    return profile

@router.put(
    "/profile",
    response_model=RecruiterProfileResponse
)
def update_recruiter_profile(
    profile_data: RecruiterProfileCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update the recruiter profile of the authenticated recruiter.

    Args:
        profile_data: Updated recruiter profile information.
        db: Database session used to access PostgreSQL.
        current_user: Authenticated user making the request.

    Returns:
        The updated recruiter profile.

    Raises:
        HTTPException: If the user is not a recruiter, the profile does not
            exist, or the company does not exist.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can update a recruiter profile."
        )

    profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found."
        )

    company = (
        db.query(Company)
        .filter(Company.id == profile_data.company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found."
        )

    profile.designation = profile_data.designation
    profile.company_id = profile_data.company_id

    db.commit()
    db.refresh(profile)

    return profile