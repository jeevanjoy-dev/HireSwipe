
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

OTP_SECRET = os.getenv("OTP_SECRET")

if not OTP_SECRET:
    raise RuntimeError("OTP_SECRET is missing from environment variables.")

OTP_EXPIRY_MINUTES = 5
OTP_LENGTH = 6
MAX_OTP_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60


def generate_otp() -> str:
    return f"{secrets.randbelow(10 ** OTP_LENGTH):06d}"


def hash_otp(otp: str) -> str:
    return hmac.new(
        OTP_SECRET.encode("utf-8"),
        otp.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def verify_otp(entered_otp: str, stored_hash: str) -> bool:
    return hmac.compare_digest(
        hash_otp(entered_otp),
        stored_hash
    )


def generate_registration_token() -> str:
    return secrets.token_urlsafe(32)


def hash_registration_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def get_otp_expiry() -> datetime:
    return datetime.utcnow() + timedelta(
        minutes=OTP_EXPIRY_MINUTES
    )


def can_resend_otp(last_sent_at: datetime | None) -> bool:
    if last_sent_at is None:
        return True

    elapsed = datetime.utcnow() - last_sent_at

    return elapsed.total_seconds() >= RESEND_COOLDOWN_SECONDS
