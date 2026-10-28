from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Literal

from app.database import get_db
from app.dependencies.security import get_current_user
from app.models.application import Application
from app.models.candidate_profile import CandidateProfile
from app.models.job import Job
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationDetailResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
)
from app.models.recruiter_profile import RecruiterProfile

router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
)


@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def apply_for_job(
    application_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a job application for the authenticated candidate.

    Args:
        application_data: Job ID supplied by the candidate.
        db: Database session used to access application data.
        current_user: Authenticated user submitting the application.

    Returns:
        Application: The newly created job application.

    Raises:
        HTTPException: If the user is not a candidate, the candidate
            profile does not exist, the job does not exist, or the
            candidate has already applied for the job.
    """

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can apply for jobs.",
        )

    candidate_profile = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if candidate_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found.",
        )

    job = (
        db.query(Job)
        .filter(
            Job.id == application_data.job_id,
            Job.is_active.is_(True),
        )
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active job not found.",
        )

    existing_application = (
        db.query(Application)
        .filter(
            Application.candidate_id == candidate_profile.id,
            Application.job_id == job.id,
        )
        .first()
    )

    if existing_application is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied for this job.",
        )

    application = Application(
        candidate_id=candidate_profile.id,
        job_id=job.id,
    )

    db.add(application)
    db.commit()
    db.refresh(application)

    return application


@router.get(
    "/my-applications",
    response_model=list[ApplicationResponse],
    )
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ):
    """Get all applications submitted by the authenticated candidate.

    Args:
        db: Database session used to retrieve applications.
        current_user: Authenticated candidate requesting their applications.

    Returns:
        list[Application]: Applications submitted by the current candidate.

    Raises:
        HTTPException: If the authenticated user is not a candidate or
            the candidate profile does not exist.
    """

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can view their applications.",
        )

    candidate_profile = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == current_user.id)
        .first()
    )

    if candidate_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found.",
        )

    applications = (
        db.query(Application)
        .filter(Application.candidate_id == candidate_profile.id)
        .order_by(Application.applied_at.desc())  # Show newest applications first
        .all()
    )

    return applications

@router.get(
    "/recruiter-applications",
    response_model=list[ApplicationResponse],
  )
def get_recruiter_applications(
    status_filter: Literal[
        "Applied",
        "Shortlisted",
        "Rejected",
        "Selected",
    ] | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get applications submitted to jobs owned by the authenticated recruiter.

    Args:
        db: Database session used to retrieve applications.
        current_user: Authenticated recruiter requesting applications.

    Returns:
        list[Application]: Applications submitted to the recruiter's jobs.

    Raises:
        HTTPException: If the user is not a recruiter or the recruiter
            profile does not exist.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can view job applications.",
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

    query = (
    db.query(Application)
    .join(Job, Application.job_id == Job.id)
    .filter(Job.recruiter_id == recruiter_profile.id)
    )

    if status_filter:
        query = query.filter(                         # Filter applications by status
            Application.status == status_filter
    )

    applications = (
    query
    .order_by(Application.applied_at.desc())       # Show newest applications first
    .all()
    )
    return applications

@router.get(
    "/{application_id}",
    response_model=ApplicationDetailResponse,
)
def get_application_details(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed information about an accessible application.

    Args:
        application_id: ID of the application to retrieve.
        db: Database session used to retrieve application data.
        current_user: Authenticated user requesting the application.

    Returns:
        ApplicationDetailResponse: Detailed application information.

    Raises:
        HTTPException: If the application does not exist or the user
            is not authorized to access it.
    """

    application = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.id == application_id)
        .first()
    )

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )

    if current_user.role == "candidate":
        candidate_profile = (
            db.query(CandidateProfile)
            .filter(CandidateProfile.user_id == current_user.id)
            .first()
        )

        if candidate_profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate profile not found.",
            )

        if application.candidate_id != candidate_profile.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to view this application.",
            )

    elif current_user.role == "recruiter":
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

        if application.job.recruiter_id != recruiter_profile.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to view this application.",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to view applications.",
        )

    return ApplicationDetailResponse(
        id=application.id,
        candidate_id=application.candidate_id,
        job_id=application.job_id,
        job_title=application.job.title,
        job_location=application.job.location,
        job_type=application.job.job_type,
        status=application.status,
        applied_at=application.applied_at,
    )

@router.put(
    "/{application_id}/status",
    response_model=ApplicationResponse,
)
def update_application_status(
    application_id: int,
    status_data: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the status of an application owned by the authenticated recruiter.

    Args:
        application_id: ID of the application to update.
        status_data: New status assigned to the application.
        db: Database session used to update the application.
        current_user: Authenticated recruiter performing the update.

    Returns:
        Application: The updated application.

    Raises:
        HTTPException: If the user is not a recruiter, the recruiter
            profile does not exist, the application does not exist,
            or the application belongs to another recruiter.
    """

    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters can update application status.",
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

    application = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.id == application_id)
        .first()
    )

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )

    if application.job.recruiter_id != recruiter_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to update this application.",
        )

    application.status = status_data.status

    db.commit()
    db.refresh(application)

    return application