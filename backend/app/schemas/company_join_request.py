
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CompanyJoinRequestCreate(BaseModel):
    """Represent a request to join a company."""

    company_id: int


class CompanyJoinRequestReview(BaseModel):
    """Represent an admin's decision on a join request."""

    status: str


class CompanyJoinRequestResponse(BaseModel):
    """Represent company join request information."""

    id: int
    recruiter_id: int
    company_id: int
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by_user_id: int | None = None

    model_config = ConfigDict(from_attributes=True)
