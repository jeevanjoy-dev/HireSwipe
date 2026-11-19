
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ReapprovalStatus = Literal[
    "pending",
    "approved",
    "rejected",
]


class JobReapprovalCreate(BaseModel):
    recruiter_message: str | None = Field(
        default=None,
        max_length=2000,
    )


class JobReapprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    recruiter_id: int
    status: ReapprovalStatus
    recruiter_message: str | None
    admin_notes: str | None
    reviewed_by: int | None
    reviewed_at: datetime | None
    created_at: datetime


class AdminJobReapprovalResponse(JobReapprovalResponse):
    pass


class JobReapprovalReview(BaseModel):
    status: Literal["approved", "rejected"]

    admin_notes: str | None = Field(
        default=None,
        max_length=3000,
    )
