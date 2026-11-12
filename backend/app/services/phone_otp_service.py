
import logging
import os
import secrets

logger = logging.getLogger(__name__)


def get_phone_otp() -> str:
    """Generate a six-digit OTP for simulated SMS in development."""

    mode = os.getenv("PHONE_OTP_MODE", "mock").lower()

    if mode != "mock":
        raise RuntimeError(
            "A real SMS provider has not been configured."
        )

    return f"{secrets.randbelow(1000000):06d}"


def send_phone_otp(phone: str, otp: str) -> None:
    """Simulate sending an SMS by logging the OTP."""

    mode = os.getenv("PHONE_OTP_MODE", "mock").lower()

    if mode != "mock":
        raise RuntimeError(
            "A real SMS provider has not been configured."
        )

    logger.warning(
        "[SIMULATED SMS] Phone: %s | OTP: %s",
        phone,
        otp,
    )
