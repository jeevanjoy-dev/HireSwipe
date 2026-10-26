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
    tags=["Jobs"],
)


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    job_data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new job for the authenticated recruiter.

    Args:
        job_data: Information required to create the job.
        db: Database session used to create the job.
        current_user: Authenticated recruiter creating the job.

    Returns:
        Job: The newly created job.

    Raises:
        HTTPException: If the user is not a recruiter or does not
            have a recruiter profile.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create jobs.",
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
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
        requirements=job_data.requirements,
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return new_job


@router.get("/my-jobs", response_model=list[JobResponse])
def get_my_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all jobs posted by the authenticated recruiter.

    Args:
        db: Database session used to retrieve jobs.
        current_user: Authenticated recruiter requesting their jobs.

    Returns:
        list[Job]: Jobs owned by the authenticated recruiter.

    Raises:
        HTTPException: If the user is not a recruiter or does not
            have a recruiter profile.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can view their jobs.",
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
        )

    jobs = (
        db.query(Job)
        .filter(Job.recruiter_id == recruiter_profile.id)
        .order_by(Job.created_at.desc())
        .all()
    )

    return jobs


@router.get("/", response_model=list[JobResponse])
def get_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all active jobs for the authenticated candidate.

    Args:
        db: Database session used to retrieve jobs.
        current_user: Authenticated candidate browsing jobs.

    Returns:
        list[Job]: A list of active jobs.

    Raises:
        HTTPException: If the authenticated user is not a candidate.
    """

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can browse jobs.",
        )

    jobs = (
        db.query(Job)
        .filter(Job.is_active == True)
        .order_by(Job.created_at.desc())
        .all()
    )

    return jobs


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a job by ID for the recruiter who owns the job.

    Args:
        job_id: ID of the job to retrieve.
        db: Database session used to retrieve the job.
        current_user: Authenticated recruiter requesting the job.

    Returns:
        Job: The requested job owned by the authenticated recruiter.

    Raises:
        HTTPException: If the user is not a recruiter, the recruiter
            profile does not exist, the job does not exist, or the
            recruiter does not own the job.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can access jobs by ID.",
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
        )

    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    if job.recruiter_id != recruiter_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this job.",
        )

    return job


@router.put("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    job_data: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
            profile does not exist, the job does not exist, the recruiter
            does not own the job, or the salary range is invalid.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can update jobs.",
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
        )

    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    if job.recruiter_id != recruiter_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to modify this job.",
        )

    update_data = job_data.model_dump(exclude_unset=True)

    new_salary_min = update_data.get("salary_min", job.salary_min)
    new_salary_max = update_data.get("salary_max", job.salary_max)

    if (
        new_salary_min is not None
        and new_salary_max is not None
        and new_salary_min > new_salary_max
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Minimum salary cannot be greater than maximum salary.",
        )

    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a job owned by the authenticated recruiter.

    Args:
        job_id: ID of the job to delete.
        db: Database session used to delete the job.
        current_user: Authenticated recruiter.

    Raises:
        HTTPException: If the user is not a recruiter, the recruiter
            profile does not exist, the job does not exist, or the
            recruiter does not own the job.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can delete jobs.",
        )

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.user_id == current_user.id)
        .first()
    )

    if recruiter_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found.",
        )

    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    if job.recruiter_id != recruiter_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to delete this job.",
        )

    db.delete(job)
    db.commit()

    return None