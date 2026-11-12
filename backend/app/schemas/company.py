
from pydantic import BaseModel


class CompanyCreate(BaseModel):
    """Represent data required to create a company."""

    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None


class CompanyResponse(BaseModel):
    """Represent company information returned by the API."""

    id: int
    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None
    admin_profile_photo: str | None = None


class CompanyUpdate(BaseModel):
    """Represent editable company information."""

    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None
