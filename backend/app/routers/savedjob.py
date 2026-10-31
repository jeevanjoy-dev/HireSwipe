from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.security import get_current_user
from app.models.candidate_profile import CandidateProfile
from app.models.job import Job
from app.models.savedjob import SavedJob
from app.models.user import User

router = APIRouter(
    prefix="/saved-jobs",
    tags=["Saved Jobs"],
)


@router.post("/{job_id}", status_code=status.HTTP_201_CREATED)
def save_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a job for the authenticated candidate.

    Args:
        job_id: ID of the job to save.
        db: Active database session.
        current_user: Authenticated user.

    Returns:
        SavedJob: The newly created saved job record.

    Raises:
        HTTPException: If the user is not a candidate, the job does not
            exist, or the job is already saved.
    """
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can save jobs.",
        )

    candidate = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found.",
        )

    job = db.query(Job).filter(Job.id == job_id).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    existing = (
        db.query(SavedJob)
        .filter(
            SavedJob.candidate_id == candidate.id,
            SavedJob.job_id == job.id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Job is already saved.",
        )

    saved_job = SavedJob(
        candidate_id=candidate.id,
        job_id=job.id,
    )

    db.add(saved_job)
    db.commit()
    db.refresh(saved_job)

    return saved_job


@router.delete("/{job_id}")
def unsave_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a saved job for the authenticated candidate.

    Args:
        job_id: ID of the job to remove from saved jobs.
        db: Active database session.
        current_user: Authenticated user.

    Returns:
        dict: Confirmation message.

    Raises:
        HTTPException: If the user is not a candidate or the saved job
            does not exist.
    """
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can remove saved jobs.",
        )

    candidate = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found.",
        )

    saved_job = (
        db.query(SavedJob)
        .filter(
            SavedJob.candidate_id == candidate.id,
            SavedJob.job_id == job_id,
        )
        .first()
    )

    if saved_job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved job not found.",
        )

    db.delete(saved_job)
    db.commit()

    return {"message": "Job removed from saved jobs."}


@router.get("/")
def get_saved_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all jobs saved by the authenticated candidate.

    Args:
        db: Active database session.
        current_user: Authenticated user.

    Returns:
        list[Job]: Jobs saved by the candidate.

    Raises:
        HTTPException: If the user is not a candidate or the candidate
            profile does not exist.
    """
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can view saved jobs.",
        )

    candidate = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found.",
        )

    saved_jobs = (
        db.query(Job)
        .join(SavedJob, SavedJob.job_id == Job.id)
        .filter(SavedJob.candidate_id == candidate.id)
        .order_by(SavedJob.saved_at.desc())
        .all()
    )

    return saved_jobs