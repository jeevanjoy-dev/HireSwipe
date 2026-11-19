
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user

from app.models.job import Job
from app.models.recruiter_profile import RecruiterProfile
from app.models.company import Company
from app.models.user import User
from app.models.job_reapproval_request import JobReapprovalRequest

from app.schemas.job import (
    JobCreate,
    JobResponse,
    JobUpdate,
    JobListResponse,
    
)

from app.schemas.job_reapproval import (
    JobReapprovalCreate,
    JobReapprovalResponse,
)


router = APIRouter(
    prefix="/jobs",
    tags=["Jobs"],
)


# --------------------------------------------------
# COMPANY ACCESS HELPER
# --------------------------------------------------

def get_verified_recruiter_company(
    recruiter_profile: RecruiterProfile,
    db: Session,
) -> Company:
    """Return the recruiter's company only if it is verified."""

    if recruiter_profile.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be associated with a company to perform this action.",
        )

    company = (
        db.query(Company)
        .filter(Company.id == recruiter_profile.company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated company not found.",
        )

    if company.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your company must have an approved verification "
                "status to perform this action."
            ),
        )

    return company


# --------------------------------------------------
# RECRUITER BLOCK CHECK
# --------------------------------------------------

def ensure_recruiter_access(current_user: User, db: Session):
    """
    Prevent individually blocked recruiters and recruiters
    belonging to a company whose primary recruiter is blocked
    from managing jobs.
    """

    # Check individual recruiter block
    if current_user.is_blocked:
        reason = current_user.blocked_reason or "No reason provided."

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Your recruiter account has been blocked.",
                "reason": reason,
                "blocked_type": "individual",
            },
        )

    # Find the recruiter's profile
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

    # Find the associated company
    if recruiter_profile.company_id is None:
        return

    company = (
        db.query(Company)
        .filter(Company.id == recruiter_profile.company_id)
        .first()
    )

    if company is None or company.admin_user_id is None:
        return

    # Check whether the primary recruiter is blocked
    primary_recruiter = (
        db.query(User)
        .filter(User.id == company.admin_user_id)
        .first()
    )

    if primary_recruiter and primary_recruiter.is_blocked:
        reason = (
            primary_recruiter.blocked_reason
            or "No reason provided."
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": (
                    "Your company's primary recruiter has been blocked. "
                    "Job management is temporarily restricted."
                ),
                "reason": reason,
                "blocked_type": "primary_recruiter",
            },
        )


# --------------------------------------------------
# CREATE JOB
# --------------------------------------------------

@router.post(
    "/",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job(
    job_data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a job for a recruiter belonging to a verified company."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can create jobs.",
        )

    ensure_recruiter_access(current_user, db)
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

    get_verified_recruiter_company(
        recruiter_profile,
        db,
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
        application_method=job_data.application_method,
        application_url=(
            str(job_data.application_url)
            if job_data.application_url
            else None
        ),
        application_email=(
            str(job_data.application_email)
            if job_data.application_email
            else None
        ),
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return new_job


# --------------------------------------------------
# GET MY JOBS
# --------------------------------------------------

@router.get(
    "/my-jobs",
    response_model=list[JobResponse],
)
def get_my_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all jobs posted by the authenticated recruiter."""

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


# --------------------------------------------------
# SUBMIT JOB REAPPROVAL REQUEST
# --------------------------------------------------

@router.post(
    "/{job_id}/reapproval-request",
    response_model=JobReapprovalResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_job_reapproval_request(
    job_id: int,
    request_data: JobReapprovalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow a recruiter to request reapproval for a hidden job."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can request job reapproval.",
        )

    ensure_recruiter_access(current_user, db)

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

    get_verified_recruiter_company(recruiter_profile, db)

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
            detail="You are not allowed to request reapproval for this job.",
        )

    if job.moderation_status == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permanently deactivated jobs cannot be submitted for reapproval.",
        )

    if job.moderation_status != "hidden":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only hidden jobs can be submitted for reapproval.",
        )

    existing_request = (
        db.query(JobReapprovalRequest)
        .filter(
            JobReapprovalRequest.job_id == job.id,
            JobReapprovalRequest.status == "pending",
        )
        .first()
    )

    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A reapproval request is already pending for this job.",
        )

    new_request = JobReapprovalRequest(
        job_id=job.id,
        recruiter_id=recruiter_profile.id,
        recruiter_message=request_data.recruiter_message,
        status="pending",
    )

    job.moderation_status = "pending_reapproval"

    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return new_request


# --------------------------------------------------
# GET MY JOB REAPPROVAL REQUESTS
# --------------------------------------------------

@router.get(
    "/my-reapproval-requests",
    response_model=list[JobReapprovalResponse],
)
def get_my_reapproval_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get reapproval requests submitted by the authenticated recruiter."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can view their reapproval requests.",
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

    requests = (
        db.query(JobReapprovalRequest)
        .filter(
            JobReapprovalRequest.recruiter_id == recruiter_profile.id
        )
        .order_by(JobReapprovalRequest.created_at.desc())
        .all()
    )

    return requests

# --------------------------------------------------
# GET RECRUITER ACCESS STATUS
# --------------------------------------------------

@router.get("/recruiter-access-status")
def get_recruiter_access_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the recruiter's individual and company-level block status."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can access this endpoint.",
        )

    # Check individual block first
    if current_user.is_blocked:
        return {
            "is_restricted": True,
            "blocked_type": "individual",
            "reason": current_user.blocked_reason or "No reason provided.",
            "message": "Your recruiter account has been blocked.",
        }

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

    # Check primary recruiter block
    if recruiter_profile.company_id is not None:
        company = (
            db.query(Company)
            .filter(Company.id == recruiter_profile.company_id)
            .first()
        )

        if company and company.admin_user_id is not None:
            primary_recruiter = (
                db.query(User)
                .filter(User.id == company.admin_user_id)
                .first()
            )

            if primary_recruiter and primary_recruiter.is_blocked:
                return {
                    "is_restricted": True,
                    "blocked_type": "primary_recruiter",
                    "reason": (
                        primary_recruiter.blocked_reason
                        or "No reason provided."
                    ),
                    "message": (
                        "Your company's primary recruiter has been blocked. "
                        "Job management is temporarily restricted."
                    ),
                }

    return {
        "is_restricted": False,
        "blocked_type": None,
        "reason": None,
        "message": "Your recruiter account has normal access.",
    }


# --------------------------------------------------
# SEARCH AND FILTER JOBS
# --------------------------------------------------

@router.get(
    "/",
    response_model=JobListResponse,
)
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
    """Search jobs that are active, moderated and from verified companies."""

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
            detail=(
                "Minimum experience cannot be greater "
                "than maximum experience."
            ),
        )

    query = (
        db.query(Job)
        .join(
            RecruiterProfile,
            Job.recruiter_id == RecruiterProfile.id,
        )
        .join(
            User,
            RecruiterProfile.user_id == User.id,
        )
        .join(
            Company,
            RecruiterProfile.company_id == Company.id,
        )
        .filter(
            Job.is_active.is_(True),
            Job.moderation_status == "normal",
            Company.verification_status == "verified",
            User.is_blocked.is_(False),
        )
    )

    if keyword:
        search_term = f"%{keyword}%"

        query = query.filter(
            (Job.title.ilike(search_term))
            | (Job.description.ilike(search_term))
            | (Job.requirements.ilike(search_term))
        )

    if location:
        query = query.filter(
            Job.location.ilike(f"%{location}%")
        )

    if job_type:
        query = query.filter(
            Job.job_type == job_type
        )

    if experience_min is not None:
        query = query.filter(
            (Job.experience_max.is_(None))
            | (Job.experience_max >= experience_min)
        )

    if experience_max is not None:
        query = query.filter(
            (Job.experience_min.is_(None))
            | (Job.experience_min <= experience_max)
        )

    total = query.count()

    jobs = (
        query
        .order_by(Job.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return JobListResponse(
        total=total,
        skip=skip,
        limit=limit,
        jobs=jobs,
    )


# --------------------------------------------------
# GET JOB DETAILS
# --------------------------------------------------

@router.get(
    "/{job_id}",
    response_model=JobResponse,
)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a job only when it is visible to candidates."""

    job = (
        db.query(Job)
        .join(
            RecruiterProfile,
            Job.recruiter_id == RecruiterProfile.id,
        )
        .join(
            User,
            RecruiterProfile.user_id == User.id,
        )
        .join(
            Company,
            RecruiterProfile.company_id == Company.id,
        )
        .filter(
            Job.id == job_id,
            Job.is_active.is_(True),
            Job.moderation_status == "normal",
            Company.verification_status == "verified",
            User.is_blocked.is_(False),
        )
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    return job


# --------------------------------------------------
# UPDATE JOB
# --------------------------------------------------

@router.put(
    "/{job_id}",
    response_model=JobResponse,
)
def update_job(
    job_id: int,
    job_data: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a job owned by a recruiter belonging to a verified company."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can update jobs.",
        )

    ensure_recruiter_access(current_user, db)

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

    get_verified_recruiter_company(
        recruiter_profile,
        db,
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
            detail=(
                "Minimum experience cannot be greater "
                "than maximum experience."
            ),
        )

    if (
        new_salary_min is not None
        and new_salary_max is not None
        and new_salary_min > new_salary_max
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Minimum salary cannot be greater "
                "than maximum salary."
            ),
        )

    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    return job


# --------------------------------------------------
# DELETE JOB
# --------------------------------------------------

@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a job owned by the authenticated recruiter."""

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can delete jobs.",
        )

    ensure_recruiter_access(current_user, db)

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
