
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Literal

from app.database import get_db
from app.dependencies.security import get_current_user
from app.models.application import Application
from app.models.candidate_profile import CandidateProfile
from app.models.job import Job
from app.models.user import User
from app.models.recruiter_profile import RecruiterProfile
from app.schemas.application import (
    ApplicationCreate,
    ApplicationDetailResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
)
from app.services.file_storage import (
    save_upload,
    get_stored_file,
    ALLOWED_RESUME_EXTENSIONS,
    MAX_RESUME_SIZE,
)


router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
)


# --------------------------------------------------
# APPLY FOR A JOB
# --------------------------------------------------

@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply_for_job(
    job_id: int = Form(...),
    about_yourself: str = Form(
        ...,
        min_length=20,
        max_length=2000,
    ),
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a platform job application with a mandatory resume."""

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
            Job.id == job_id,
            Job.is_active.is_(True),
        )
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active job not found.",
        )

    if job.application_method != "Platform":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job does not accept applications through HireSwipe.",
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

    if not resume.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A resume is required to apply.",
        )

    resume_key = None

    try:
        resume_key = await save_upload(
            upload=resume,
            category="application_resumes",
            allowed_extensions=ALLOWED_RESUME_EXTENSIONS,
            max_size=MAX_RESUME_SIZE,
        )

        application = Application(
            candidate_id=candidate_profile.id,
            job_id=job.id,
            about_yourself=about_yourself,
            resume=resume_key,
        )

        db.add(application)
        db.commit()
        db.refresh(application)

        return application

    except Exception:
        db.rollback()

        if resume_key:
            from app.services.file_storage import delete_stored_file
            delete_stored_file(resume_key)

        raise

    finally:
        await resume.close()


# --------------------------------------------------
# GET MY APPLICATIONS
# --------------------------------------------------


@router.get(
    "/my-applications",
    response_model=list[ApplicationDetailResponse],
)
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed applications submitted by the authenticated candidate."""

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
        .join(Job, Application.job_id == Job.id)
        .filter(
            Application.candidate_id == candidate_profile.id,
            Application.is_archived.is_(False),
        )
        .order_by(Application.applied_at.desc())
        .all()
    )

    return [
        ApplicationDetailResponse(
            id=application.id,
            candidate_id=application.candidate_id,
            job_id=application.job_id,
            job_title=application.job.title,
            job_location=application.job.location,
            job_type=application.job.job_type,
            about_yourself=application.about_yourself,
            has_resume=bool(application.resume),
            status=application.status,
            applied_at=application.applied_at,
        )
        for application in applications
    ]



# --------------------------------------------------
# GET RECRUITER APPLICATIONS
# --------------------------------------------------

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
    """Get applications submitted to jobs owned by the recruiter."""

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
        query = query.filter(Application.status == status_filter)

    applications = (
        query
        .order_by(Application.applied_at.desc())
        .all()
    )

    return applications


# --------------------------------------------------
# ARCHIVE APPLICATION
# --------------------------------------------------

@router.put(
    "/{application_id}/archive",
    response_model=ApplicationResponse,
)
def archive_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Archive an application belonging to the authenticated candidate."""

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can archive applications.",
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

    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )

    if application.candidate_id != candidate_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to archive this application.",
        )

    application.is_archived = True

    db.commit()
    db.refresh(application)

    return application


# --------------------------------------------------
# GET ARCHIVED APPLICATIONS
# --------------------------------------------------

@router.get(
    "/archived",
    response_model=list[ApplicationDetailResponse],
)
def get_archived_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return applications archived by the authenticated candidate."""

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can view archived applications.",
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
        .join(Job, Application.job_id == Job.id)
        .filter(
            Application.candidate_id == candidate_profile.id,
            Application.is_archived.is_(True),
        )
        .order_by(Application.applied_at.desc())
        .all()
    )

    return [
        ApplicationDetailResponse(
            id=application.id,
            candidate_id=application.candidate_id,
            job_id=application.job_id,
            job_title=application.job.title,
            job_location=application.job.location,
            job_type=application.job.job_type,
            about_yourself=application.about_yourself,
            status=application.status,
            applied_at=application.applied_at,
        )
        for application in applications
    ]


# --------------------------------------------------
# DOWNLOAD APPLICATION RESUME
# --------------------------------------------------


@router.get("/{application_id}/resume")
def download_application_resume(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow the candidate or authorized recruiter to access the resume."""

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

    # Verify candidate ownership.
    if current_user.role == "candidate":
        candidate_profile = (
            db.query(CandidateProfile)
            .filter(CandidateProfile.user_id == current_user.id)
            .first()
        )

        if (
            candidate_profile is None
            or application.candidate_id != candidate_profile.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot access this application resume.",
            )

    # Verify recruiter ownership of the job.
    elif current_user.role == "recruiter":
        recruiter_profile = (
            db.query(RecruiterProfile)
            .filter(RecruiterProfile.user_id == current_user.id)
            .first()
        )

        if (
            recruiter_profile is None
            or application.job.recruiter_id != recruiter_profile.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot access this application resume.",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access application resumes.",
        )

    if not application.resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume was submitted with this application.",
        )

    # Retrieve the stored resume.
    file_path = get_stored_file(application.resume)

    # Identify the file format.
    mime_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    media_type = mime_types.get(file_path.suffix.lower())

    if media_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported resume format.",
        )

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=media_type,
        headers={
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# --------------------------------------------------
# UPDATE APPLICATION STATUS
# --------------------------------------------------

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
    """Update the status of an application owned by the recruiter."""

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


