
from pydantic import BaseModel, ConfigDict, Field


class CompanyCreate(BaseModel):
    """Represent data required to create a company."""

    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None


class CompanyResponse(BaseModel):
    """Represent company information returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None
    admin_profile_photo: str | None = None

    # Business contact information
    business_email: str | None = None
    business_phone: str | None = None
    business_address: str | None = None

    # Email verification status
    business_email_verified: bool = False

    # Document verification status
    documents_status: str = "not_submitted"

    # Overall verification status
    verification_status: str = "unverified"


class CompanyUpdate(BaseModel):
    """Represent editable company information."""

    name: str
    description: str | None = None
    location: str | None = None
    website: str | None = None

    # International phone number: + followed by 8–15 digits
    business_phone: str | None = Field(
        default=None,
        pattern=r"^\+[1-9]\d{7,14}$"
    )

    business_address: str | None = None


class CompanyBusinessEmailRequest(BaseModel):
    """Request to verify the company's official business email."""

    business_email: str


class CompanyBusinessEmailOTPVerifyRequest(BaseModel):
    """Request to verify the OTP sent to the business email."""

    otp: str
