from pydantic import BaseModel


class CompanyCreate(BaseModel):
    """Represent data required to create a company.

    Attributes:
        name: Name of the company.
        description: Description of the company.
        location: Company's location.
        website: Company's website URL.
    """

    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None


class CompanyResponse(BaseModel):
    """Represent company information returned by the API.

    Attributes:
        id: Unique identifier for the company.
        name: Name of the company.
        description: Description of the company.
        location: Company's location.
        website: Company's website URL.
    """

    id: int
    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None