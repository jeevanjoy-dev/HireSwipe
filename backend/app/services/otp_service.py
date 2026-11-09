
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta


OTP_EXPIRY_MINUTES = 5
OTP_LENGTH = 6
MAX_OTP_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60


def generate_otp() -> str:
    """Generate a cryptographically secure six-digit OTP."""

    return f"{secrets.randbelow(10 ** OTP_LENGTH):06d}"


def hash_otp(otp: str) -> str:
    """Hash an OTP before storing it in the database."""

    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def verify_otp(entered_otp: str, stored_hash: str) -> bool:
    """Safely compare an entered OTP with its stored hash."""

    return hmac.compare_digest(
        hash_otp(entered_otp),
        stored_hash
    )


def generate_registration_token() -> str:
    """Generate a secure registration session token."""

    return secrets.token_urlsafe(32)


def hash_registration_token(token: str) -> str:
    """Hash a registration token before storing it."""

    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def get_otp_expiry() -> datetime:
    """Return the OTP expiration time."""

    return datetime.utcnow() + timedelta(
        minutes=OTP_EXPIRY_MINUTES
    )


def can_resend_otp(last_sent_at: datetime | None) -> bool:
    """Check whether the OTP resend cooldown has passed."""

    if last_sent_at is None:
        return True

    elapsed = datetime.utcnow() - last_sent_at

    return elapsed.total_seconds() >= RESEND_COOLDOWN_SECONDS
