from pydantic import BaseModel, ConfigDict

class CandidateProfileCreate(BaseModel):
    """Represent data required to create a candidate profile.

    Attributes:
        phone: Candidate's phone number.
        location: Candidate's current location.
        bio: Short description about the candidate.
        resume: Resume file reference.
    """

    phone: str | None = None
    location: str | None = None
    bio: str | None = None
    resume: str | None = None


class CandidateProfileUpdate(BaseModel):
    """Represent data that can be used to update a candidate profile.

    Attributes:
        phone: Updated phone number.
        location: Updated candidate location.
        bio: Updated candidate biography.
        resume: Updated resume file reference.
    """

    phone: str | None = None
    location: str | None = None
    bio: str | None = None
    resume: str | None = None


class CandidateProfileResponse(BaseModel):
    """Represent candidate profile information returned by the API.

    Attributes:
        id: Unique identifier for the candidate profile.
        user_id: ID of the user who owns the profile.
        phone: Candidate's phone number.
        location: Candidate's current location.
        bio: Candidate's biography.
        resume: Resume file reference.
    """

    id: int
    user_id: int
    phone: str | None = None
    location: str | None = None
    bio: str | None = None
    resume: str | None = None