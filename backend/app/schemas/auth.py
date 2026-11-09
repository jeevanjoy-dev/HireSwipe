
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    """Data required to register a new user."""

    name: str
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    password: str
    role: Literal["candidate", "recruiter"]


class LoginRequest(BaseModel):
    """Credentials required for user login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT authentication response."""

    access_token: str
    token_type: str


class UserResponse(BaseModel):
    """Safe user information returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    phone: str | None = None
    role: str
    created_at: datetime


class EmailUpdateRequest(BaseModel):
    """Data required to update a user's email address."""

    new_email: EmailStr
    current_password: str


class RegistrationStartRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8)
    role: str = Field(pattern="^(candidate|recruiter)$")


class RegistrationStartResponse(BaseModel):
    registration_token: str
    message: str


class OTPVerificationRequest(BaseModel):
    registration_token: str
    otp: str = Field(pattern=r"^\d{6}$")


class RegistrationStatusResponse(BaseModel):
    email_verified: bool
    phone_verified: bool
    message: str


class RegistrationTokenRequest(BaseModel):
    registration_token: str


class RegistrationCompleteResponse(BaseModel):
    message: str
    user: UserResponse

