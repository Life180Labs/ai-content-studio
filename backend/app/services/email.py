"""
Email service — sends verification emails via SMTP.
"""

from __future__ import annotations

import aiosmtplib
import structlog
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import get_settings

logger = structlog.get_logger("email")


async def send_verification_email(email: str, name: str, otp: str) -> None:
    """Send an email verification OTP to the user."""
    settings = get_settings()

    if settings.is_development and not settings.SMTP_USER:
        # In dev without SMTP config, just log the OTP
        logger.info("dev_otp_code", email=email, otp=otp)
        return

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background: #0A0A0B; color: #FAFAFA; }}
            .container {{ max-width: 480px; margin: 40px auto; padding: 40px; background: #111113; border-radius: 12px; border: 1px solid #27272A; }}
            .logo {{ font-size: 20px; font-weight: 700; color: #818CF8; margin-bottom: 32px; }}
            h1 {{ font-size: 24px; font-weight: 600; margin-bottom: 16px; }}
            p {{ color: #A1A1AA; line-height: 1.6; }}
            .otp {{ font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #818CF8; background: #1A1A1E; padding: 16px 32px; border-radius: 8px; display: inline-block; margin: 24px 0; }}
            .footer {{ font-size: 12px; color: #71717A; margin-top: 32px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">AI Content Studio</div>
            <h1>Verify your email</h1>
            <p>Hi {name},</p>
            <p>Enter this code to verify your email address and activate your account:</p>
            <div class="otp">{otp}</div>
            <p>This code expires in 15 minutes.</p>
            <p class="footer">If you didn't create an account, you can safely ignore this email.</p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your verification code: {otp}"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = email
    msg.attach(MIMEText(f"Your verification code is: {otp}", "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("verification_email_sent", email=email)
    except Exception as e:
        logger.error("email_send_failed", email=email, error=str(e))
        raise
