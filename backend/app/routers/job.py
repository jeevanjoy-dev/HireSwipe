from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.job import Job
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User
from app.schemas.job import JobCreate, JobResponse, JobUpdate

router = APIRouter(
    prefix="/jobs",
    tags=["Jobs"]
)


@router.post("/", response_model=JobResponse)
def create_job(
    job_data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new job for the authenticated recruiter.

    Args:
        job_data: Information required to create the job.
        db: Database session used to store the job.
        current_user: Authenticated user creating the job.

    Returns:
        Job: The newly created job.

    Raises:
        HTTPException: If the user is not a recruiter or does not
            have a recruiter profile.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create jobs."
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found."
        )

    new_job = Job(
        recruiter_id=recruiter_profile.id,
        title=job_data.title,
        description=job_data.description,
        location=job_data.location,
        job_type=job_data.job_type,
        experience_required=job_data.experience_required,
        salary_min=job_data.salary_min,
        salary_max=job_data.salary_max,
        requirements=job_data.requirements
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return new_job

@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db)
):
    """Get a job by its ID.

    Args:
        job_id: ID of the job to retrieve.
        db: Database session used to retrieve the job.

    Returns:
        Job: The requested job.

    Raises:
        HTTPException: If the job does not exist.
    """

    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found."
        )

    return job

@router.get("/", response_model=list[JobResponse])
def get_jobs(
    db: Session = Depends(get_db)
):
    """Get all active jobs.

    Args:
        db: Database session used to retrieve jobs.

    Returns:
        list[Job]: A list of active jobs.
    """

    jobs = (
        db.query(Job)
        .filter(Job.is_active == True)
        .order_by(Job.created_at.desc())
        .all()
    )

    return jobs

@router.put("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    job_data: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a job owned by the authenticated recruiter.

    Args:
        job_id: ID of the job to update.
        job_data: Updated job information.
        db: Database session used to update the job.
        current_user: Authenticated recruiter.

    Returns:
        Job: The updated job.

    Raises:
        HTTPException: If the user is not a recruiter, the recruiter
            profile does not exist, or the job does not exist or
            belong to the recruiter.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can update jobs."
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found."
        )

    job = (
        db.query(Job)
        .filter(
            Job.id == job_id,
            Job.recruiter_id == recruiter_profile.id
        )
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found."
        )

    update_data = job_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    return job

@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a job owned by the authenticated recruiter.

    Args:
        job_id: ID of the job to delete.
        db: Database session used to delete the job.
        current_user: Authenticated recruiter.

    Returns:
        dict: Confirmation that the job was deleted.

    Raises:
        HTTPException: If the user is not a recruiter, the recruiter
            profile does not exist, or the job does not exist or
            belong to the recruiter.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can delete jobs."
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found."
        )

    job = (
        db.query(Job)
        .filter(
            Job.id == job_id,
            Job.recruiter_id == recruiter_profile.id
        )
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found."
        )

    db.delete(job)
    db.commit()

    return {
        "message": "Job deleted successfully."
    }