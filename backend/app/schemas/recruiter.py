
from pydantic import BaseModel, ConfigDict


class RecruiterProfileCreate(BaseModel):
    """Represent data required to create a recruiter profile."""

    designation: str


class RecruiterProfileUpdate(BaseModel):
    """Represent editable recruiter-specific profile information."""

    designation: str


class CompanyProfileResponse(BaseModel):
    """Represent company information within a recruiter profile."""

    id: int
    admin_user_id:int
    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RecruiterProfileResponse(BaseModel):
    """Represent recruiter profile information returned by the API."""

    id: int
    user_id: int
    designation: str
    company: CompanyProfileResponse

    model_config = ConfigDict(from_attributes=True)
