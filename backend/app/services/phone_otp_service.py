
import os


def get_phone_otp() -> str:
    """Return the configured mock OTP in development mode."""

    mode = os.getenv("PHONE_OTP_MODE", "mock").lower()

    if mode != "mock":
        raise RuntimeError(
            "A real SMS provider has not been configured."
        )

    otp = os.getenv("MOCK_PHONE_OTP")

    if not otp or len(otp) != 6 or not otp.isdigit():
        raise RuntimeError(
            "Mock phone OTP configuration is invalid."
        )

    return otp
