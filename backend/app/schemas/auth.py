from pydantic import BaseModel, EmailStr


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
    role: str


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
    """

    id: int
    name: str
    email: EmailStr
    role: str