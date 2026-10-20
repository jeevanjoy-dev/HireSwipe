from pydantic import BaseModel


class RecruiterProfileCreate(BaseModel):
    """Represent data required to create a recruiter profile.

    Attributes:
        designation: Job designation of the recruiter.
        company_id: ID of the company associated with the recruiter.
    """

    designation: str
    company_id: int


class RecruiterProfileResponse(BaseModel):
    """Represent recruiter profile information returned by the API.

    Attributes:
        id: Unique identifier of the recruiter profile.
        user_id: ID of the user who owns the profile.
        company_id: ID of the associated company.
        designation: Job designation of the recruiter.
    """

    id: int
    user_id: int
    company_id: int
    designation: str