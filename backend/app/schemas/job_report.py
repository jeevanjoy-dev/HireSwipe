
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------
# REPORT REASONS
# --------------------------------------------------

ReportReason = Literal[
    "fake",
    "misleading",
    "payment",
    "inappropriate",
    "duplicate",
    "impersonation",
    "other",
]


ReportStatus = Literal[
    "pending",
    "under_review",
    "resolved",
    "dismissed",
]


# --------------------------------------------------
# CREATE JOB REPORT
# --------------------------------------------------

class JobReportCreate(BaseModel):

    job_id: int = Field(gt=0)

    reason: ReportReason

    description: str | None = Field(
        default=None,
        max_length=2000,
    )


# --------------------------------------------------
# CANDIDATE REPORT RESPONSE
# --------------------------------------------------

class JobReportResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    reason: str
    description: str | None
    status: str
    created_at: datetime
    reviewed_at: datetime | None


# --------------------------------------------------
# CANDIDATE REPORT HISTORY
# --------------------------------------------------

class MyJobReportResponse(JobReportResponse):
    pass


# --------------------------------------------------
# ADMIN REPORT RESPONSE
# --------------------------------------------------

class AdminJobReportResponse(JobReportResponse):

    candidate_id: int
    reviewed_by: int | None
    admin_notes: str | None


# --------------------------------------------------
# ADMIN REVIEW REQUEST
# --------------------------------------------------

class JobReportReview(BaseModel):

    status: Literal[
        "under_review",
        "resolved",
        "dismissed",
    ]

    admin_notes: str | None = Field(
        default=None,
        max_length=3000,
    )
