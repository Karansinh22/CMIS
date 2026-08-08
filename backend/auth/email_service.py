"""
auth/email_service.py — Send OTP verification emails via SMTP.
Uses aiosmtplib for async sending (runs from background thread if needed).
Falls back to console print in dev mode when no SMTP is configured.
"""

from __future__ import annotations

import logging

from config import settings

logger = logging.getLogger(__name__)


async def send_otp_email(to_email: str, otp: str, purpose: str = "verify") -> None:
    """
    Send a 6-digit OTP to the given email address.
    purpose: 'verify' | 'reset'
    """
    subject_map = {
        "verify": "CMIS — Verify Your Email",
        "reset":  "CMIS — Password Reset OTP",
    }
    body_map = {
        "verify": (
            f"Welcome to CMIS!\n\n"
            f"Your email verification OTP is:\n\n"
            f"    {otp}\n\n"
            f"It expires in {settings.otp_expire_minutes} minutes.\n\n"
            f"If you did not create an account, you can ignore this email."
        ),
        "reset": (
            f"You requested a password reset for your CMIS account.\n\n"
            f"Your OTP is:\n\n"
            f"    {otp}\n\n"
            f"It expires in {settings.otp_expire_minutes} minutes.\n\n"
            f"If you did not request this, you can ignore this email."
        ),
    }

    subject = subject_map.get(purpose, "CMIS OTP")
    body    = body_map.get(purpose, f"Your OTP: {otp}")

    # ── Dev fallback: just log the OTP ───────────────────────────────────────
    if not settings.smtp_host or settings.smtp_host == "localhost":
        logger.warning(
            "[DEV MODE] Email OTP for %s (%s): %s", to_email, purpose, otp
        )
        return

    # ── Production: send via aiosmtplib ──────────────────────────────────────
    try:
        import aiosmtplib
        from email.mime.text import MIMEText

        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"]    = settings.smtp_from
        msg["To"]      = to_email

        use_tls = (settings.smtp_port == 465)
        start_tls = (settings.smtp_port == 587) or (settings.smtp_tls and not use_tls)

        pwd = settings.smtp_password.replace(" ", "") if settings.smtp_password else None

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=pwd,
            use_tls=use_tls,
            start_tls=start_tls,
        )
        logger.info("OTP email sent to %s", to_email)
    except Exception as exc:
        logger.error("Failed to send OTP email to %s via SMTP: %s", to_email, exc)
        logger.warning(
            "[DEV FALLBACK] Email OTP for %s (%s): %s", to_email, purpose, otp
        )
        print(f"\n==================================================")
        print(f" [CMIS OTP] Verification Code for {to_email}: {otp}")
        print(f"==================================================\n")

