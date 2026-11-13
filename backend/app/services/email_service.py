
import os
import smtplib
import ssl

from email.message import EmailMessage
from email.utils import formataddr
from dotenv import load_dotenv

load_dotenv()


def send_otp_email(
    recipient_email: str,
    otp: str,
    purpose: str = "registration"
) -> None:
    """Send registration, login, or company verification OTP."""

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_email or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured.")

    email_templates = {
        "login": (
            "HireSwipe - Login OTP",
            "Your HireSwipe login verification code",
            "Use this OTP to securely log in to your account."
        ),
        "company_verification": (
            "HireSwipe - Company Email Verification",
            "Verify your company's official email",
            "Use this OTP to verify your company's business email "
            "for HireSwipe employer verification."
        ),
        "registration": (
            "HireSwipe - Registration OTP",
            "Welcome to HireSwipe!",
            "Use this OTP to verify your email address."
        )
    }

    subject, heading, description = email_templates.get(
        purpose,
        email_templates["registration"]
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr(("HireSwipe Admin", smtp_email))
    message["To"] = recipient_email

    message.set_content(f"""
Hello,

{heading}

{description}

Your OTP is:

{otp}

This OTP expires in 5 minutes.

If you did not request this code, please ignore this email.

Regards,
HireSwipe Team
""")

    try:
        context = ssl.create_default_context()

        with smtplib.SMTP(
            smtp_host,
            smtp_port,
            timeout=20
        ) as server:

            server.ehlo()
            server.starttls(context=context)
            server.ehlo()

            server.login(smtp_email, smtp_password)
            server.send_message(message)

    except smtplib.SMTPAuthenticationError:
        raise RuntimeError(
            "Gmail authentication failed. Check your App Password."
        )

    except (smtplib.SMTPException, OSError) as exc:
        raise RuntimeError(
            f"Failed to send OTP email: {exc}"
        ) from exc
