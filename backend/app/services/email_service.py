
import os
import smtplib

from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()


def send_otp_email(
    recipient_email: str,
    otp: str,
    purpose: str = "registration"
) -> None:
    """Send registration or login OTP using Gmail SMTP."""

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_email or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured.")

    if purpose == "login":
        subject = "HireSwipe - Login OTP"
        heading = "Your HireSwipe login verification code"
        description = "Use this OTP to securely log in to your account."
    else:
        subject = "HireSwipe - Registration OTP"
        heading = "Welcome to HireSwipe!"
        description = "Use this OTP to verify your email address."

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_email
    message["To"] = recipient_email

    message.set_content(
        f"""
Hello,

{heading}

{description}

Your OTP is:

{otp}

This OTP expires in 5 minutes.

If you did not request this code, please ignore this email.

Regards,
HireSwipe Team
"""
    )

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(message)
