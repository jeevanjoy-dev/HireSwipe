
from pydantic import BaseModel, ConfigDict

class CandidateProfileCreate(BaseModel):
    """Represent data required to create a candidate profile."""

    phone: str | None = None
    location: str | None = None
    bio: str | None = None
    resume: str | None = None

class CandidateProfileUpdate(BaseModel):
    """Represent data that can be used to update a candidate profile."""

    phone: str | None = None
    location: str | None = None
    bio: str | None = None
    resume: str | None = None

class CandidateProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    phone: str | None = None
    location: str | None = None
    bio: str | None = None
    resume: str | None = None
    resume_filename: str | None = None
    profile_photo: str | None = None