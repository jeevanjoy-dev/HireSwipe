from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.job import Job
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User
from app.schemas.job import JobCreate, JobResponse, JobUpdate, JobListResponse


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
        experience_min=job_data.experience_min,
        experience_max=job_data.experience_max,
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


@router.get("/", response_model=JobListResponse)
def get_jobs(
    keyword: str | None = Query(default=None),
    location: str | None = Query(default=None),
    job_type: Literal[
        "Full-time",
        "Part-time",
        "Internship",
    ] | None = Query(default=None),
    experience_min: int | None = Query(default=None, ge=0),
    experience_max: int | None = Query(default=None, ge=0),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search and filter active jobs for the authenticated candidate.

    Args:
        keyword: Optional keyword used to search job title,
            description, and requirements.
        location: Optional location used to filter jobs.
        job_type: Optional employment type used to filter jobs.
        experience_min: Optional minimum years of experience used
            to filter jobs.
        experience_max: Optional maximum years of experience used
            to filter jobs.
        skip: Number of jobs to skip for pagination.
        limit: Maximum number of jobs to return.
        db: Database session used to retrieve jobs.
        current_user: Authenticated candidate requesting jobs.

    Returns:
        JobListResponse: Paginated active jobs matching the filters,
           along with pagination metadata.

    Raises:
        HTTPException: If the authenticated user is not a candidate
            or the experience range is invalid.
    """

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can browse jobs.",
        )

    if (
        experience_min is not None
        and experience_max is not None
        and experience_min > experience_max
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Minimum experience cannot be greater than maximum experience.",
        )

    query = db.query(Job).filter(Job.is_active.is_(True))  # Only search active jobs

    if keyword:
        search_term = f"%{keyword}%"  # Add wildcards for partial matching

        query = query.filter(                         # Search title, description, and requirements
            (Job.title.ilike(search_term))
            | (Job.description.ilike(search_term))
            | (Job.requirements.ilike(search_term))
        )

    if location:
        query = query.filter(                         # Filter jobs by location
            Job.location.ilike(f"%{location}%")
        )

    if job_type:
        query = query.filter(                         # Filter jobs by employment type
            Job.job_type == job_type
        )

    if experience_min is not None:
        query = query.filter(                         # Match jobs whose maximum overlaps the selected minimum
            (Job.experience_max.is_(None))
            | (Job.experience_max >= experience_min)
        )

    if experience_max is not None:
        query = query.filter(                         # Match jobs whose minimum overlaps the selected maximum
            (Job.experience_min.is_(None))
            | (Job.experience_min <= experience_max)
        )

    total = query.count()                         # Count all jobs matching the filters

    jobs = (
        query
        .order_by(Job.created_at.desc())           # Show newest jobs first
        .offset(skip)                              # Skip previous results
        .limit(limit)                              # Limit returned results
        .all()
    )

    return JobListResponse(
        total=total,
        skip=skip,
        limit=limit,
        jobs=jobs,
    )

    
@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get an active job by its ID.

    Args:
        job_id: Unique identifier of the job.
        db: Database session used to query the job.
        current_user: Authenticated user requesting the job.

    Returns:
        JobResponse containing the requested active job.

    Raises:
        HTTPException: If the job does not exist or is inactive.
    """

    job = (
        db.query(Job)
        .filter(
            Job.id == job_id,
            Job.is_active.is_(True),
        )
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
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
            does not own the job, or an experience/salary range is invalid.
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

    new_salary_min = update_data.get(
        "salary_min",
        job.salary_min,
    )

    new_salary_max = update_data.get(
        "salary_max",
        job.salary_max,
    )

    new_experience_min = update_data.get(
        "experience_min",
        job.experience_min,
    )

    new_experience_max = update_data.get(
        "experience_max",
        job.experience_max,
    )

    if (
        new_experience_min is not None
        and new_experience_max is not None
        and new_experience_min > new_experience_max
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Minimum experience cannot be greater than maximum experience.",
        )

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