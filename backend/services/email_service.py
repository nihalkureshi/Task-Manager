import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")

EMAIL_USER = (os.getenv("EMAIL_USER") or "").strip()
EMAIL_PASSWORD = (os.getenv("EMAIL_PASSWORD") or "").replace(" ", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
APP_NAME = os.getenv("APP_NAME", "HairDrama Task Manager")


def _credentials_configured():
    return bool(EMAIL_USER and EMAIL_PASSWORD)


def send_email(to_email, subject, body, details=None):
    if not to_email:
        print("EMAIL ERROR: recipient address is missing")
        return False

    if not _credentials_configured():
        print("EMAIL ERROR: EMAIL_USER and EMAIL_PASSWORD must be set in backend/.env")
        return False

    if SMTP_HOST == "smtp.gmail.com" and len(EMAIL_PASSWORD) != 16:
        print(
            "EMAIL ERROR: Gmail requires a 16-character App Password, not your normal login password. "
            "Create one at https://myaccount.google.com/apppasswords"
        )
        return False

    details = details or {}
    detail_rows = "".join(
        f'<tr><td style="padding:8px 12px;font-weight:600;color:#374151;vertical-align:top;">{label}</td>'
        f'<td style="padding:8px 12px;color:#111827;">{value}</td></tr>'
        for label, value in details.items()
    )

    html_body = f"""
    <html>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#111827;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
                    {APP_NAME}
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">{subject}</h2>
                    <p style="margin:0 0 20px;color:#4b5563;line-height:1.6;">{body}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                      {detail_rows}
                    </table>
                    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
                      This is an automated notification from {APP_NAME}.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  """

    plain_lines = [body, ""]
    for label, value in details.items():
        plain_lines.append(f"{label}: {value}")
    plain_body = "\n".join(plain_lines)

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{APP_NAME}] {subject}"
        msg["From"] = formataddr((APP_NAME, EMAIL_USER))
        msg["To"] = to_email
        msg["Reply-To"] = EMAIL_USER
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain=EMAIL_USER.split("@")[-1])

        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)

        print(f"EMAIL SENT to {to_email}")
        return True

    except smtplib.SMTPAuthenticationError:
        print(
            "EMAIL ERROR: Gmail rejected the login. Use a 16-character App Password from "
            "https://myaccount.google.com/apppasswords and set EMAIL_USER to the same Gmail address."
        )
        return False

    except Exception as e:
        print(f"EMAIL ERROR: {e}")
        return False
