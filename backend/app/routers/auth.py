
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.pending_registration import PendingRegistration
from app.models.login_challenge import LoginChallenge

from app.schemas.auth import (
    RegistrationStartRequest,
    RegistrationStartResponse,
    OTPVerificationRequest,
    RegistrationTokenRequest,
    EmailLoginRequest,
    EmailLoginStartResponse,
    EmailLoginOTPVerifyRequest,
    GoogleAuthRequest,
    AuthResponse,
    UserResponse,
)

from app.dependencies.security import create_access_token
from app.dependencies.auth import get_current_user

from app.services.otp_service import (
    generate_otp,
    hash_otp,
    generate_registration_token,
    hash_registration_token,
    get_otp_expiry,
    verify_otp,
    MAX_OTP_ATTEMPTS,
    can_resend_otp,
)

from app.services.email_service import send_otp_email


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# ==================================================
# HELPER: CREATE AUTH RESPONSE
# ==================================================

def create_auth_response(user: User):
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


# ==================================================
# EMAIL REGISTRATION - STEP 1
# START REGISTRATION
# ==================================================

@router.post(
    "/register/start",
    response_model=RegistrationStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_registration(
    user_data: RegistrationStartRequest,
    db: Session = Depends(get_db),
):
    """Start registration and send email OTP."""

    email = str(user_data.email)

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    existing_pending = (
        db.query(PendingRegistration)
        .filter(PendingRegistration.email == email)
        .first()
    )

    if existing_pending:
        raise HTTPException(
            status_code=409,
            detail="Registration is already pending for this email.",
        )

    registration_token = generate_registration_token()
    otp = generate_otp()

    pending = PendingRegistration(
        registration_token_hash=hash_registration_token(
            registration_token
        ),
        name=user_data.name,
        email=email,
        role=user_data.role,
        email_otp_hash=hash_otp(otp),
        email_verified=False,
        email_otp_expires_at=get_otp_expiry(),
        email_otp_attempts=0,
        email_last_sent_at=datetime.utcnow(),
    )

    try:
        db.add(pending)
        db.flush()

        send_otp_email(
            recipient_email=email,
            otp=otp,
            purpose="registration",
        )

        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=503,
            detail="Could not send verification email. Please try again.",
        ) from exc

    return {
        "registration_token": registration_token,
        "message": "Verification OTP sent to your email.",
    }


# ==================================================
# EMAIL REGISTRATION - RESEND OTP
# ==================================================

@router.post("/register/resend-otp")
def resend_registration_otp(
    token_data: RegistrationTokenRequest,
    db: Session = Depends(get_db),
):
    """Resend the registration verification OTP."""

    token_hash = hash_registration_token(
        token_data.registration_token
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

    if not can_resend_otp(pending.email_last_sent_at):
        raise HTTPException(
            status_code=429,
            detail="Please wait before requesting another OTP.",
        )

    otp = generate_otp()

    pending.email_otp_hash = hash_otp(otp)
    pending.email_otp_expires_at = get_otp_expiry()
    pending.email_otp_attempts = 0
    pending.email_last_sent_at = datetime.utcnow()

    try:
        send_otp_email(
            recipient_email=pending.email,
            otp=otp,
            purpose="registration",
        )

        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=503,
            detail="Could not resend verification email. Please try again.",
        ) from exc

    return {
        "message": "A new verification OTP has been sent to your email."
    }


# ==================================================
# EMAIL REGISTRATION - STEP 2
# VERIFY OTP AND CREATE ACCOUNT
# ==================================================

@router.post(
    "/register/verify-email",
    response_model=AuthResponse,
)
def verify_registration_email(
    verification_data: OTPVerificationRequest,
    db: Session = Depends(get_db),
):
    """Verify registration email and create the account."""

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

    if pending.email_otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect OTP attempts.",
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
        phone=None,
        email_verified=True,
        phone_verified=False,
        role=pending.role,
    )

    try:
        db.add(new_user)
        db.flush()

        db.delete(pending)
        db.commit()
        db.refresh(new_user)

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not create your account.",
        ) from exc

    return create_auth_response(new_user)


# ==================================================
# EMAIL LOGIN - STEP 1
# SEND LOGIN OTP
# ==================================================

@router.post(
    "/login/start",
    response_model=EmailLoginStartResponse,
)
def start_email_login(
    login_data: EmailLoginRequest,
    db: Session = Depends(get_db),
):
    """Create a login challenge and send OTP if account exists."""

    email = str(login_data.email)

    latest_challenge = (
        db.query(LoginChallenge)
        .filter(LoginChallenge.email == email)
        .order_by(LoginChallenge.created_at.desc())
        .first()
    )

    if latest_challenge and not can_resend_otp(
        latest_challenge.last_sent_at
    ):
        raise HTTPException(
            status_code=429,
            detail="Please wait before requesting another OTP.",
        )

    user = (
        db.query(User)
        .filter(
            User.email == email,
            User.email_verified.is_(True),
        )
        .first()
    )

    challenge_token = generate_registration_token()
    otp = generate_otp()

    # Create a challenge even if the email is not registered.
    # This helps prevent account enumeration.

    challenge = LoginChallenge(
        email=email,
        challenge_token_hash=hash_registration_token(
            challenge_token
        ),
        otp_hash=hash_otp(otp),
        otp_expires_at=get_otp_expiry(),
        otp_attempts=0,
        last_sent_at=datetime.utcnow(),
    )

    try:
        db.add(challenge)
        db.flush()

        if user:
            send_otp_email(
                recipient_email=email,
                otp=otp,
                purpose="login",
            )

        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=503,
            detail="Could not process login OTP request.",
        ) from exc

    return {
        "challenge_token": challenge_token,
        "message": (
            "If an account exists with this email, "
            "a login OTP has been sent."
        ),
    }


# ==================================================
# EMAIL LOGIN - STEP 2
# VERIFY LOGIN OTP
# ==================================================

@router.post(
    "/login/verify",
    response_model=AuthResponse,
)
def verify_email_login(
    verification_data: EmailLoginOTPVerifyRequest,
    db: Session = Depends(get_db),
):
    """Verify login OTP and issue JWT."""

    token_hash = hash_registration_token(
        verification_data.challenge_token
    )

    challenge = (
        db.query(LoginChallenge)
        .filter(
            LoginChallenge.challenge_token_hash == token_hash
        )
        .first()
    )

    if not challenge:
        raise HTTPException(
            status_code=404,
            detail="Login session not found.",
        )

    if challenge.otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect OTP attempts.",
        )

    if datetime.utcnow() > challenge.otp_expires_at:
        raise HTTPException(
            status_code=400,
            detail="Login OTP has expired.",
        )

    if not verify_otp(
        verification_data.otp,
        challenge.otp_hash,
    ):
        challenge.otp_attempts += 1
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Invalid login OTP.",
        )

    user = (
        db.query(User)
        .filter(
            User.email == challenge.email,
            User.email_verified.is_(True),
        )
        .first()
    )

    if not user:
        db.delete(challenge)
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or OTP.",
        )

    try:
        db.delete(challenge)
        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not complete login.",
        ) from exc

    return create_auth_response(user)


# ==================================================
# GOOGLE SIGN-IN
# ==================================================

@router.post(
    "/google",
    response_model=AuthResponse,
)
def google_authentication(
    google_data: GoogleAuthRequest,
    db: Session = Depends(get_db),
):
    """Verify Google ID token and authenticate the user."""

    google_client_id = os.getenv("GOOGLE_CLIENT_ID")

    if not google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google authentication is not configured.",
        )

    try:
        google_user = id_token.verify_oauth2_token(
            google_data.id_token,
            google_requests.Request(),
            google_client_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google authentication token.",
        ) from exc

    email = google_user.get("email")
    email_verified = google_user.get("email_verified")
    name = google_user.get("name")

    if not email or email_verified is not True:
        raise HTTPException(
            status_code=401,
            detail="Google email is not verified.",
        )

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user:
        if not user.email_verified:
            raise HTTPException(
                status_code=403,
                detail="Please complete email verification first.",
            )

    else:
        if not google_data.role:
            raise HTTPException(
                status_code=400,
                detail="Please select an account type to create your account.",
            )

        new_user = User(
            name=name or email.split("@")[0],
            email=email,
            phone=None,
            email_verified=True,
            phone_verified=False,
            role=google_data.role,
        )

        try:
            db.add(new_user)
            db.commit()
            db.refresh(new_user)

        except Exception as exc:
            db.rollback()

            raise HTTPException(
                status_code=500,
                detail="Could not create your Google account.",
            ) from exc

        user = new_user

    return create_auth_response(user)


# ==================================================
# CURRENT USER
# ==================================================

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user's details."""

    return current_user
