from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.dependencies.auth import (
    get_current_user,
    get_current_admin,
)

from app.models.user import User
from app.models.job import Job
from app.models.job_report import JobReport
from app.models.recruiter_profile import RecruiterProfile
from app.models.company import Company

from app.schemas.job_report import (
    JobReportCreate,
    JobReportResponse,
    MyJobReportResponse,
    JobReportReview,
)


router = APIRouter(
    prefix="/job-reports",
    tags=["Job Reports"],
)


# --------------------------------------------------
# ADMIN REPORT DETAILS HELPER
# --------------------------------------------------

def build_admin_report_response(
    report: JobReport,
    db: Session,
):
    """
    Build a detailed report response for platform admins.

    Candidate identity and admin notes are only returned
    through admin-protected endpoints.
    """

    job = db.query(Job).filter(
        Job.id == report.job_id
    ).first()

    candidate = db.query(User).filter(
        User.id == report.candidate_id
    ).first()

    recruiter_profile = None
    recruiter = None
    company = None

    if job:
        recruiter_profile = db.query(RecruiterProfile).filter(
            RecruiterProfile.id == job.recruiter_id
        ).first()

    if recruiter_profile:
        recruiter = db.query(User).filter(
            User.id == recruiter_profile.user_id
        ).first()

        if recruiter_profile.company_id:
            company = db.query(Company).filter(
                Company.id == recruiter_profile.company_id
            ).first()

        if company is None and recruiter:
            company = db.query(Company).filter(
                Company.admin_user_id == recruiter.id
            ).first()

    return {
        "id": report.id,
        "job_id": report.job_id,
        "candidate_id": report.candidate_id,
        "reason": report.reason,
        "description": report.description,
        "status": report.status,
        "admin_notes": report.admin_notes,
        "reviewed_by": report.reviewed_by,
        "reviewed_at": report.reviewed_at,
        "created_at": report.created_at,

        "candidate": {
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
        } if candidate else None,

        "job": {
            "id": job.id,
            "title": job.title,
            "description": job.description,
            "location": job.location,
            "job_type": job.job_type,
            "is_active": job.is_active,
            "moderation_status": job.moderation_status,
            "moderation_reason": job.moderation_reason,
        } if job else None,

        "recruiter": {
            "id": recruiter.id,
            "name": recruiter.name,
            "email": recruiter.email,
            "is_blocked": recruiter.is_blocked,
            "blocked_reason": recruiter.blocked_reason,
        } if recruiter else None,

        "company": {
            "id": company.id,
            "name": company.name,
            "verification_status": company.verification_status,
        } if company else None,
    }


# --------------------------------------------------
# SUBMIT JOB REPORT
# --------------------------------------------------

@router.post(
    "/",
    response_model=JobReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job_report(
    report_data: JobReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow candidates to report a job posting."""

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can report jobs.",
        )

    job = (
        db.query(Job)
        .filter(Job.id == report_data.job_id)
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    # Prevent reporting own job.

    recruiter_profile = (
        db.query(RecruiterProfile)
        .filter(
            RecruiterProfile.id == job.recruiter_id,
            RecruiterProfile.user_id == current_user.id,
        )
        .first()
    )

    if recruiter_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot report your own job.",
        )

    # Prevent duplicate reports.

    existing_report = (
        db.query(JobReport)
        .filter(
            JobReport.job_id == job.id,
            JobReport.candidate_id == current_user.id,
        )
        .first()
    )

    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reported this job.",
        )

    new_report = JobReport(
        job_id=job.id,
        candidate_id=current_user.id,
        reason=report_data.reason,
        description=(
            report_data.description.strip()
            if report_data.description
            and report_data.description.strip()
            else None
        ),
        status="pending",
    )

    db.add(new_report)

    try:
        db.commit()
        db.refresh(new_report)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reported this job.",
        )

    return new_report


# --------------------------------------------------
# GET MY REPORTS
# --------------------------------------------------

@router.get(
    "/my-reports",
    response_model=list[MyJobReportResponse],
)
def get_my_job_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all reports submitted by the authenticated candidate."""

    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can view their reports.",
        )

    reports = (
        db.query(JobReport)
        .filter(
            JobReport.candidate_id == current_user.id
        )
        .order_by(JobReport.created_at.desc())
        .all()
    )

    return reports


# --------------------------------------------------
# ADMIN - LIST ALL JOB REPORTS
# --------------------------------------------------

@router.get("/admin")
def get_all_job_reports(
    report_status: str | None = Query(
        default=None,
        alias="status",
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Return all candidate job reports for platform admin review.

    Optional filters:
    - status=pending
    - status=under_review
    - status=resolved
    - status=dismissed
    """

    allowed_statuses = {
        "pending",
        "under_review",
        "resolved",
        "dismissed",
    }

    query = db.query(JobReport)

    if report_status:
        if report_status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid report status.",
            )

        query = query.filter(
            JobReport.status == report_status
        )

    total = query.count()

    reports = (
        query
        .order_by(JobReport.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = [
        build_admin_report_response(report, db)
        for report in reports
    ]

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "reports": results,
    }


# --------------------------------------------------
# ADMIN - VIEW SINGLE JOB REPORT
# --------------------------------------------------

@router.get("/admin/{report_id}")
def get_job_report_details(
    report_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Return complete information about an individual job report."""

    report = db.query(JobReport).filter(
        JobReport.id == report_id
    ).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job report not found.",
        )

    return build_admin_report_response(report, db)


# --------------------------------------------------
# ADMIN - REVIEW JOB REPORT
# --------------------------------------------------

@router.put("/admin/{report_id}/review")
def review_job_report(
    report_id: int,
    review_data: JobReportReview,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Allow platform admins to review a candidate job report.

    Supported review statuses:
    - under_review
    - resolved
    - dismissed

    This endpoint updates the report review information.
    It does not automatically deactivate jobs or block recruiters.
    """

    report = (
        db.query(JobReport)
        .filter(JobReport.id == report_id)
        .with_for_update()
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job report not found.",
        )

    # Prevent changing a report that has already been finalized.

    if report.status in {"resolved", "dismissed"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This report has already been finalized.",
        )

    # Update report status.

    report.status = review_data.status

    # Store private admin notes.

    report.admin_notes = (
        review_data.admin_notes.strip()
        if review_data.admin_notes
        and review_data.admin_notes.strip()
        else None
    )

    # Store review information.

    report.reviewed_by = admin.id
    report.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    return {
        "message": "Job report reviewed successfully.",
        "report_id": report.id,
        "status": report.status,
        "admin_notes": report.admin_notes,
        "reviewed_by": report.reviewed_by,
        "reviewed_at": report.reviewed_at,
    }