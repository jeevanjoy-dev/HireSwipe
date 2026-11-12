
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.candidate_profile import CandidateProfile
from app.models.user import User
from app.schemas.candidate import (
    CandidateProfileCreate,
    CandidateProfileUpdate,
    CandidateProfileResponse,
)
from app.services.file_storage import (
    save_upload,
    get_stored_file,
    delete_stored_file,
    ALLOWED_RESUME_EXTENSIONS,
    ALLOWED_PHOTO_EXTENSIONS,
    MAX_RESUME_SIZE,
    MAX_PHOTO_SIZE,
)


router = APIRouter(
    prefix="/candidate",
    tags=["Candidate"],
)


def get_candidate_profile_or_404(
    db: Session,
    current_user: User,
) -> CandidateProfile:
    """Get the authenticated candidate's profile."""

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can access candidate profiles.",
        )

    profile = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found.",
        )

    return profile


# --------------------------------------------------
# CREATE CANDIDATE PROFILE
# --------------------------------------------------

@router.post(
    "/profile",
    response_model=CandidateProfileResponse,
)
def create_candidate_profile(
    profile_data: CandidateProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can create candidate profiles.",
        )

    existing_profile = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate profile already exists.",
        )

    new_profile = CandidateProfile(
        user_id=current_user.id,
        phone=None,
        location=profile_data.location,
        bio=profile_data.bio,
        resume=None,
        resume_filename=None,
        profile_photo=None,
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return new_profile


# --------------------------------------------------
# GET CANDIDATE PROFILE
# --------------------------------------------------

@router.get(
    "/profile",
    response_model=CandidateProfileResponse,
)
def get_candidate_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_candidate_profile_or_404(db, current_user)


# --------------------------------------------------
# UPDATE CANDIDATE PROFILE
# --------------------------------------------------

@router.put(
    "/profile",
    response_model=CandidateProfileResponse,
)
def update_candidate_profile(
    profile_data: CandidateProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_candidate_profile_or_404(db, current_user)

    if profile_data.location is not None:
        profile.location = profile_data.location

    if profile_data.bio is not None:
        profile.bio = profile_data.bio

    # Resume and profile photo are managed only through
    # their dedicated upload/delete endpoints.

    db.commit()
    db.refresh(profile)

    return profile


# --------------------------------------------------
# UPLOAD / REPLACE PROFILE RESUME
# --------------------------------------------------

@router.post("/profile/resume")
async def upload_candidate_resume(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_candidate_profile_or_404(db, current_user)

    # Preserve only the original filename, not any
    # directory information supplied by the client.
    original_filename = Path(
        file.filename or "resume"
    ).name[:255]

    new_file_key = await save_upload(
        upload=file,
        category="candidate_resumes",
        allowed_extensions=ALLOWED_RESUME_EXTENSIONS,
        max_size=MAX_RESUME_SIZE,
    )

    old_file_key = profile.resume

    try:
        profile.resume = new_file_key
        profile.resume_filename = original_filename

        db.commit()
        db.refresh(profile)

    except Exception:
        db.rollback()
        delete_stored_file(new_file_key)
        raise

    finally:
        await file.close()

    # Delete the previous stored resume only after
    # the database successfully saves the new resume.
    if old_file_key:
        delete_stored_file(old_file_key)

    return {
        "message": "Candidate resume uploaded successfully.",
        "has_resume": True,
        "resume_filename": profile.resume_filename,
    }


# --------------------------------------------------
# DOWNLOAD / VIEW PROFILE RESUME
# --------------------------------------------------

@router.get("/profile/resume")
def download_candidate_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_candidate_profile_or_404(db, current_user)

    if not profile.resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile resume has been uploaded.",
        )

    file_path = get_stored_file(profile.resume)

    return FileResponse(
        path=file_path,
        filename=profile.resume_filename or file_path.name,
        media_type="application/octet-stream",
    )


# --------------------------------------------------
# DELETE PROFILE RESUME
# --------------------------------------------------

@router.delete("/profile/resume")
def delete_candidate_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_candidate_profile_or_404(db, current_user)

    if not profile.resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile resume to delete.",
        )

    old_file_key = profile.resume

    profile.resume = None
    profile.resume_filename = None

    db.commit()

    delete_stored_file(old_file_key)

    return {
        "message": "Candidate resume deleted successfully.",
        "has_resume": False,
        "resume_filename": None,
    }


# --------------------------------------------------
# UPLOAD / REPLACE PROFILE PHOTO
# --------------------------------------------------

@router.post("/profile/photo")
async def upload_candidate_photo(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_candidate_profile_or_404(db, current_user)

    new_file_key = await save_upload(
        upload=file,
        category="profile_photos",
        allowed_extensions=ALLOWED_PHOTO_EXTENSIONS,
        max_size=MAX_PHOTO_SIZE,
    )

    old_file_key = profile.profile_photo

    try:
        profile.profile_photo = new_file_key

        db.commit()
        db.refresh(profile)

    except Exception:
        db.rollback()
        delete_stored_file(new_file_key)
        raise

    finally:
        await file.close()

    if old_file_key:
        delete_stored_file(old_file_key)

    return {
        "message": "Profile photo uploaded successfully.",
        "has_profile_photo": True,
    }


# --------------------------------------------------
# VIEW PROFILE PHOTO
# --------------------------------------------------

@router.get("/profile/photo")
def view_candidate_photo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_candidate_profile_or_404(db, current_user)

    if not profile.profile_photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile photo has been uploaded.",
        )

    file_path = get_stored_file(profile.profile_photo)

    extension = file_path.suffix.lower()

    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }

    return FileResponse(
        path=file_path,
        media_type=media_types.get(
            extension,
            "application/octet-stream",
        ),
    )


# --------------------------------------------------
# DELETE PROFILE PHOTO
# --------------------------------------------------

@router.delete("/profile/photo")
def delete_candidate_photo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_candidate_profile_or_404(db, current_user)

    if not profile.profile_photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile photo to delete.",
        )

    old_file_key = profile.profile_photo

    profile.profile_photo = None
    db.commit()

    delete_stored_file(old_file_key)

    return {
        "message": "Profile photo deleted successfully.",
        "has_profile_photo": False,
    }
