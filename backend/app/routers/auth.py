from datetime import datetime
from fastapi import status

from app.models.pending_registration import PendingRegistration

from app.schemas.auth import (
    RegistrationStartRequest,
    RegistrationStartResponse,
    OTPVerificationRequest,
    RegistrationStatusResponse,
    RegistrationTokenRequest,
    RegistrationCompleteResponse,
    
)

from app.services.otp_service import (
    generate_otp,
    hash_otp,
    generate_registration_token,
    hash_registration_token,
    get_otp_expiry,
    verify_otp,
    MAX_OTP_ATTEMPTS,
)

from app.services.email_service import send_otp_email

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    EmailUpdateRequest,
)
from app.dependencies.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.dependencies.auth import get_current_user
from app.services.phone_otp_service import get_phone_otp
from app.services.otp_service import can_resend_otp


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post(
    "/register/start",
    response_model=RegistrationStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_registration(
    user_data: RegistrationStartRequest,
    db: Session = Depends(get_db),
):
    """Create a pending registration and send email verification OTP."""

    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    existing_pending = (
        db.query(PendingRegistration)
        .filter(PendingRegistration.email == user_data.email)
        .first()
    )

    if existing_pending:
        raise HTTPException(
            status_code=409,
            detail="A registration is already pending for this email. Please contact support to restart it.",
        )

    registration_token = generate_registration_token()
    otp = generate_otp()

    pending_registration = PendingRegistration(
        registration_token_hash=hash_registration_token(
            registration_token
        ),
        name=user_data.name,
        email=str(user_data.email),
        phone=user_data.phone,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        email_otp_hash=hash_otp(otp),
        email_otp_expires_at=get_otp_expiry(),
        email_otp_attempts=0,
        email_verified=False,
        phone_verified=False,
        email_last_sent_at=datetime.utcnow(),
    )

    db.add(pending_registration)

    try:
        db.flush()

        send_otp_email(
            recipient_email=str(user_data.email),
            otp=otp,
        )

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Could not send the verification email. Please try again later.",
        )

    return {
        "registration_token": registration_token,
        "message": "Verification OTP sent to your email address.",
    }


@router.post(
    "/register/verify-email",
    response_model=RegistrationStatusResponse,
)
def verify_registration_email(
    verification_data: OTPVerificationRequest,
    db: Session = Depends(get_db),
):
    """Verify the email OTP for a pending registration."""

    token_hash = hash_registration_token(
        verification_data.registration_token
    )

    pending = (
        db.query(PendingRegistration)
        .filter(
            PendingRegistration.registration_token_hash == token_hash
        )
        .first()
    )

    if not pending:
        raise HTTPException(
            status_code=404,
            detail="Registration session not found.",
        )

    if pending.email_verified:
        return {
            "email_verified": True,
            "phone_verified": pending.phone_verified,
            "message": "Email is already verified.",
        }

    if pending.email_otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Please restart registration.",
        )

    if (
        not pending.email_otp_expires_at
        or datetime.utcnow() > pending.email_otp_expires_at
    ):
        raise HTTPException(
            status_code=400,
            detail="OTP has expired. Please request a new OTP.",
        )

    if not pending.email_otp_hash or not verify_otp(
        verification_data.otp,
        pending.email_otp_hash,
    ):
        pending.email_otp_attempts += 1
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Incorrect OTP.",
        )

    pending.email_verified = True
    pending.email_otp_hash = None
    pending.email_otp_expires_at = None

    db.commit()

    return {
        "email_verified": True,
        "phone_verified": pending.phone_verified,
        "message": "Email verified successfully. Continue with phone verification.",
    }


@router.post(
    "/register/send-phone-otp",
    response_model=RegistrationStatusResponse,
)
def send_registration_phone_otp(
    request_data: RegistrationTokenRequest,
    db: Session = Depends(get_db),
):
    """Prepare a mock phone OTP for development."""

    token_hash = hash_registration_token(
        request_data.registration_token
    )

    pending = (
        db.query(PendingRegistration)
        .filter(
            PendingRegistration.registration_token_hash == token_hash
        )
        .first()
    )

    if not pending:
        raise HTTPException(
            status_code=404,
            detail="Registration session not found.",
        )

    if not pending.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email first.",
        )

    if pending.phone_verified:
        return {
            "email_verified": True,
            "phone_verified": True,
            "message": "Phone number is already verified.",
        }

    if not can_resend_otp(pending.phone_last_sent_at):
        raise HTTPException(
            status_code=429,
            detail="Please wait before requesting another OTP.",
        )

    if pending.phone_otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Maximum OTP attempts reached. Please restart registration.",
        )

    try:
        otp = get_phone_otp()

        pending.phone_otp_hash = hash_otp(otp)
        pending.phone_otp_expires_at = get_otp_expiry()
        pending.phone_otp_attempts = 0
        pending.phone_last_sent_at = datetime.utcnow()

        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=503,
            detail="Could not prepare phone verification. Please try again.",
        ) from exc

    return {
        "email_verified": True,
        "phone_verified": False,
        "message": "Demo phone OTP is ready. Enter the development OTP.",
    }


@router.post(
    "/register/verify-phone",
    response_model=RegistrationStatusResponse,
)
def verify_registration_phone(
    verification_data: OTPVerificationRequest,
    db: Session = Depends(get_db),
):
    """Verify the mock phone OTP."""

    token_hash = hash_registration_token(
        verification_data.registration_token
    )

    pending = (
        db.query(PendingRegistration)
        .filter(
            PendingRegistration.registration_token_hash == token_hash
        )
        .first()
    )

    if not pending:
        raise HTTPException(
            status_code=404,
            detail="Registration session not found.",
        )

    if not pending.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email first.",
        )

    if pending.phone_verified:
        return {
            "email_verified": True,
            "phone_verified": True,
            "message": "Phone number is already verified.",
        }

    if pending.phone_otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Please restart registration.",
        )

    if (
        not pending.phone_otp_expires_at
        or datetime.utcnow() > pending.phone_otp_expires_at
    ):
        raise HTTPException(
            status_code=400,
            detail="OTP has expired. Please request a new OTP.",
        )

    if not pending.phone_otp_hash or not verify_otp(
        verification_data.otp,
        pending.phone_otp_hash,
    ):
        pending.phone_otp_attempts += 1
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Incorrect OTP.",
        )

    pending.phone_verified = True
    pending.phone_otp_hash = None
    pending.phone_otp_expires_at = None

    db.commit()

    return {
        "email_verified": True,
        "phone_verified": True,
        "message": "Phone number verified successfully.",
    }


@router.post(
    "/register/complete",
    response_model=RegistrationCompleteResponse,
    status_code=status.HTTP_201_CREATED,
)
def complete_registration(
    request_data: RegistrationTokenRequest,
    db: Session = Depends(get_db),
):
    """Create the permanent account after both verifications."""

    token_hash = hash_registration_token(
        request_data.registration_token
    )

    pending = (
        db.query(PendingRegistration)
        .filter(
            PendingRegistration.registration_token_hash == token_hash
        )
        .first()
    )

    if not pending:
        raise HTTPException(
            status_code=404,
            detail="Registration session not found.",
        )

    if not pending.email_verified or not pending.phone_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify both email and phone number first.",
        )

    existing_user = (
        db.query(User)
        .filter(User.email == pending.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    new_user = User(
        name=pending.name,
        email=pending.email,
        phone=pending.phone,
        password_hash=pending.password_hash,
        role=pending.role,
        email_verified=True,
        phone_verified=True,
    )

    try:
        db.add(new_user)
        db.flush()

        db.delete(pending)
        db.commit()
        db.refresh(new_user)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not complete registration.",
        )

    return {
        "message": "Registration completed successfully.",
        "user": new_user,
    }

@router.post("/login", response_model=TokenResponse)
def login_user(
    user_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate a user and return a JWT access token."""

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
def get_me(
    current_user: User = Depends(get_current_user)
):
    """Return the currently authenticated user's details."""

    return current_user


@router.put("/email", response_model=UserResponse)
def update_email(
    email_data: EmailUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the authenticated user's email address."""

    if not verify_password(
        email_data.current_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Current password is incorrect."
        )

    existing_user = (
        db.query(User)
        .filter(
            User.email == email_data.new_email,
            User.id != current_user.id
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered."
        )

    current_user.email = email_data.new_email

    db.commit()
    db.refresh(current_user)

    return current_user




