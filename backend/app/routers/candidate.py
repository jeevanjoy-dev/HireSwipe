from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.candidate_profile import CandidateProfile
from app.models.user import User
from app.schemas.candidate import (
    CandidateProfileCreate,
    CandidateProfileUpdate
)

router = APIRouter(
    prefix="/candidate",
    tags=["Candidate"]
)


@router.post("/profile")
def create_candidate_profile(
    profile_data: CandidateProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a profile for the authenticated candidate.

    Args:
        profile_data: Candidate profile information.
        db: Database session used to store the profile.
        current_user: Authenticated user creating the profile.

    Returns:
        CandidateProfile: The newly created candidate profile.

    Raises:
        HTTPException: If the authenticated user is not a candidate
            or already has a profile.
    """
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can create candidate profiles."
        )

    existing_profile = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate profile already exists."
        )

    new_profile = CandidateProfile(
        user_id=current_user.id,
        phone=profile_data.phone,
        location=profile_data.location,
        bio=profile_data.bio,
        resume=profile_data.resume
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return new_profile

@router.get("/profile")
def get_candidate_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the profile of the authenticated candidate.

    Args:
        db: Database session used to retrieve the profile.
        current_user: Authenticated user requesting the profile.

    Returns:
        CandidateProfile: The candidate's profile.

    Raises:
        HTTPException: If the user is not a candidate or
            the profile does not exist.
    """
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can view candidate profiles."
        )

    profile = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found."
        )

    return profile

@router.put("/profile")
def update_candidate_profile(
    profile_data: CandidateProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the profile of the authenticated candidate.

    Args:
        profile_data: Updated candidate profile information.
        db: Database session used to update the profile.
        current_user: Authenticated candidate.

    Returns:
        CandidateProfile: The updated candidate profile.

    Raises:
        HTTPException: If the user is not a candidate or
            the profile does not exist.
    """
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can update candidate profiles."
        )

    profile = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found."
        )

    if profile_data.phone is not None:
        profile.phone = profile_data.phone

    if profile_data.location is not None:
        profile.location = profile_data.location

    if profile_data.bio is not None:
        profile.bio = profile_data.bio

    if profile_data.resume is not None:
        profile.resume = profile_data.resume

    db.commit()
    db.refresh(profile)

    return profile