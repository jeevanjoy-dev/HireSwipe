
import os
import smtplib
import ssl
from dotenv import load_dotenv
from email.message import EmailMessage

load_dotenv()

email = os.getenv("SMTP_EMAIL")
password = os.getenv("SMTP_PASSWORD")

if not email or not password:
    raise RuntimeError("SMTP credentials missing")

message = EmailMessage()
message["Subject"] = "HireSwipe SMTP Test"
message["From"] = email
message["To"] = email
message.set_content("Gmail SMTP test successful!")

try:
    with smtplib.SMTP(
        "smtp.gmail.com",
        587,
        timeout=30
    ) as server:
        server.set_debuglevel(1)
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()

        print("Authenticating with Gmail...")
        server.login(email, password)

        print("Sending test email...")
        server.send_message(message)

    print("EMAIL SENT SUCCESSFULLY")

except Exception as error:
    print("SMTP TEST FAILED:", repr(error))
