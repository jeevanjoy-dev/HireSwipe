from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest,TokenResponse,UserResponse
from app.dependencies.security import (hash_password,verify_password,create_access_token)
from app.dependencies.auth import get_current_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/register",response_model=UserResponse)
def register_user(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    """Register a new user account.

    Args:
        user_data: Registration information provided by the user.
        db: Database session used to access the users table.

    Returns:
        dict: Confirmation message and newly created user's ID.

    Raises:
        HTTPException: If the email is already registered.
    """

    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered."
        )

    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=TokenResponse)
def login_user(
    user_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate a user and return a JWT access token.

    Args:
        user_data: Email and password provided by the user.
        db: Database session used to find the user.

    Returns:
        dict: JWT access token and token type.

    Raises:
        HTTPException: If the email or password is incorrect.
    """
    user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    if not verify_password(
        user_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the details of the currently authenticated user.

    Args:
        current_user: User obtained from the valid JWT access token.

    Returns:
        User: The currently authenticated user.
    """
    return current_user
