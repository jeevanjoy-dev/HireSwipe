
from pydantic import BaseModel, ConfigDict


class RecruiterProfileCreate(BaseModel):
    """Represent data required to create a recruiter profile."""

    designation: str


class RecruiterProfileUpdate(BaseModel):
    """Represent editable recruiter-specific profile information."""

    name: str
    designation: str

class RecruiterUserResponse(BaseModel):
    """Represent the recruiter's personal account information."""

    id: int
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)



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
    company_id: int | None = None
    designation: str | None = None
    user: RecruiterUserResponse
    company: CompanyProfileResponse | None = None

    model_config = ConfigDict(from_attributes=True)

class CompanyRecruiterResponse(BaseModel):
    """Represent a recruiter managed by a company admin."""

    id: int
    user_id: int
    name: str
    email: str
    designation: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CompanyRecruiterUpdate(BaseModel):
    """Allow a company admin to update a recruiter's basic details."""

    name: str
    email: str
    designation: str
