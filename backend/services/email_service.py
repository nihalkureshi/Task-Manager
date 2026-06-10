import smtplib
import os

from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")


def send_email(to_email, subject, body):

    try:

        msg = MIMEText(body)

        msg["Subject"] = subject
        msg["From"] = EMAIL_USER
        msg["To"] = to_email

        server = smtplib.SMTP(
            "smtp.gmail.com",
            587
        )

        server.starttls()

        server.login(
            EMAIL_USER,
            EMAIL_PASSWORD
        )

        server.send_message(msg)

        server.quit()

        print("EMAIL SENT")

    except Exception as e:

        print("EMAIL ERROR:", str(e))