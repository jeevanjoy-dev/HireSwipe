from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr

class RegisterRequest(BaseModel):
    """Represent the data required to register a new user.

    Attributes:
        name: Full name of the user.
        email: Email address used for the account.
        password: Plain-text password provided during registration.
        role: Role assigned to the user.
    """

    name: str
    email: EmailStr
    password: str
    role: Literal["candidate", "recruiter", "admin"]

class LoginRequest(BaseModel):
    """Represent the credentials required for user login.

    Attributes:
        email: Email address associated with the account.
        password: Plain-text password provided during login.
    """

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Represent the JWT authentication response.

    Attributes:
        access_token: JWT access token issued after successful authentication.
        token_type: Type of authentication token.
    """

    access_token: str
    token_type: str


class UserResponse(BaseModel):
    """Represent safe user information returned by the API.

    Attributes:
        id: Unique identifier of the user.
        name: Full name of the user.
        email: Email address of the user.
        role: Role assigned to the user.
        created_at: Date and time when the user was created
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: str
    created_at: datetime