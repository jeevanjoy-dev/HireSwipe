
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --------------------------------------------------
# COMMON TYPES
# --------------------------------------------------

UserRole = Literal["candidate", "recruiter"]


# --------------------------------------------------
# USER RESPONSE
# --------------------------------------------------

class UserResponse(BaseModel):
    """Safe user information returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    phone: str | None = None
    email_verified: bool
    phone_verified: bool
    role: str
    created_at: datetime


# --------------------------------------------------
# JWT RESPONSE
# --------------------------------------------------

class TokenResponse(BaseModel):
    """JWT authentication response."""

    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """Authentication response with user information."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --------------------------------------------------
# EMAIL REGISTRATION
# --------------------------------------------------

class RegistrationStartRequest(BaseModel):
    """Information required to start email registration."""

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: UserRole


class RegistrationStartResponse(BaseModel):
    registration_token: str
    message: str


class OTPVerificationRequest(BaseModel):
    """Email OTP verification request."""

    registration_token: str
    otp: str = Field(pattern=r"^\d{6}$")


class RegistrationStatusResponse(BaseModel):
    email_verified: bool
    message: str


class RegistrationCompleteResponse(BaseModel):
    message: str
    user: UserResponse


# --------------------------------------------------
# EMAIL OTP LOGIN
# --------------------------------------------------

class EmailLoginRequest(BaseModel):
    """Request an OTP for an existing account."""

    email: EmailStr


class EmailLoginStartResponse(BaseModel):
    """Response after initiating email login."""

    challenge_token: str
    message: str


class EmailLoginOTPVerifyRequest(BaseModel):
    """Verify the login OTP."""

    challenge_token: str
    otp: str = Field(pattern=r"^\d{6}$")


# --------------------------------------------------
# GOOGLE AUTHENTICATION
# --------------------------------------------------

class GoogleAuthRequest(BaseModel):
    """Google Sign-In request."""

    id_token: str
    role: UserRole | None = None


# --------------------------------------------------
# EMAIL UPDATE
# --------------------------------------------------

class EmailUpdateRequest(BaseModel):
    """Request to change an account email."""

    new_email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")


# --------------------------------------------------
# REGISTRATION TOKEN
# --------------------------------------------------

class RegistrationTokenRequest(BaseModel):
    registration_token: str


# --------------------------------------------------
# PHONE NUMBER VERIFICATION
# --------------------------------------------------

class PhoneOTPRequest(BaseModel):
    """Request an OTP for phone number verification."""

    phone: str = Field(
        min_length=10,
        max_length=16,
        pattern=r"^\+?[0-9]{10,15}$"
    )

class PhoneOTPVerifyRequest(BaseModel):
    """Verify the OTP sent to the requested phone number."""

    otp: str = Field(pattern=r"^\d{6}$")

class PhoneOTPResponse(BaseModel):
    """Response after requesting or verifying phone OTP."""

    message: str