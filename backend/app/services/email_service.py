
import os
import smtplib

from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()


def send_otp_email(recipient_email: str, otp: str) -> None:
    """Send an email verification OTP."""

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_email or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured.")

    message = EmailMessage()
    message["Subject"] = "HireSwipe - Email Verification OTP"
    message["From"] = smtp_email
    message["To"] = recipient_email

    message.set_content(
        f"""
Hello,

Thank you for registering with HireSwipe.

Your email verification OTP is:

{otp}

This OTP expires in 5 minutes.

If you did not request this verification, please ignore this email.

Regards,
HireSwipe Team
"""
    )

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(message)
