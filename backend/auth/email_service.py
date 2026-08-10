"""
auth/email_service.py — Send OTP verification emails via SMTP.
Uses aiosmtplib for async sending (runs from background thread if needed).
Provides high-fidelity, responsive HTML transactional email templates with plain-text fallback.
"""

from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)


def _generate_email_content(
    to_email: str,
    otp: str,
    purpose: str = "verify",
    user_name: Optional[str] = None
) -> tuple[str, str, str]:
    """
    Generate (subject, plain_text_body, html_body) for transactional OTP emails.
    """
    greeting_name = user_name.strip() if user_name and user_name.strip() else "there"
    formatted_otp = f"{otp[:3]} {otp[3:]}" if len(otp) == 6 else otp
    expire_mins = settings.otp_expire_minutes

    if purpose == "reset":
        subject = "CMIS — Password Reset OTP"
        heading = "Reset Your Password"
        intro_text = (
            "We received a request to reset the password for your CMIS account. "
            "Please use the verification code below to complete your request."
        )
        action_note = "Enter this 6-digit code in CMIS to set a new password."
    else:
        subject = "Verify your CMIS email address"
        heading = "Verify Your Email Address"
        intro_text = (
            "Thanks for creating your CMIS account. "
            "Please use the verification code below to verify your email address and complete your registration."
        )
        action_note = "Enter this 6-digit code in CMIS to verify your email address."

    # Plain text fallback
    plain_text = (
        f"CMIS - CONTEXTUAL MEETING INTELLIGENCE\n"
        f"==================================================\n\n"
        f"{heading}\n\n"
        f"Hi {greeting_name},\n\n"
        f"{intro_text}\n\n"
        f"VERIFICATION CODE:\n"
        f"  {formatted_otp}\n\n"
        f"This code expires in {expire_mins} minutes.\n"
        f"{action_note}\n\n"
        f"If you didn't request this code, you can safely ignore this email.\n\n"
        f"--------------------------------------------------\n"
        f"CMIS - Contextual Meeting Intelligence System\n"
        f"Automated notification - please do not reply."
    )

    # Professional monochrome HTML email layout (600px max width)
    html_text = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>{subject}</title>
  <!--[if mso]>
  <style type="text/css">
    table {{ border-collapse: collapse; }}
    .otp-val {{ font-family: monospace !important; }}
  </style>
  <![endif]-->
  <style>
    :root {{
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }}
    body {{
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #f4f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }}
    table {{
      border-spacing: 0;
      border-collapse: collapse;
    }}
    td {{
      padding: 0;
    }}
    @media (prefers-color-scheme: dark) {{
      body, .bg-wrapper {{ background-color: #09090b !important; }}
      .card-container {{ background-color: #141417 !important; border-color: #26262b !important; }}
      .text-heading {{ color: #ffffff !important; }}
      .text-body {{ color: #a1a1aa !important; }}
      .otp-container {{ background-color: #0f0f12 !important; border-color: #26262b !important; }}
      .otp-val {{ color: #ffffff !important; }}
      .otp-subtext {{ color: #a1a1aa !important; }}
      .security-border {{ border-color: #26262b !important; color: #71717a !important; }}
      .footer-container {{ background-color: #0f0f12 !important; border-color: #26262b !important; color: #71717a !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" class="bg-wrapper" style="background-color: #f4f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container (Max 580px) -->
        <table role="presentation" width="100%" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e4e8; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);" class="card-container">
          
          <!-- Header Branding -->
          <tr>
            <td style="background-color: #09090b; padding: 28px 32px; text-align: center;">
              <table role="presentation" width="100%">
                <tr>
                  <td align="center">
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      CMIS
                    </div>
                    <div style="font-size: 10px; font-weight: 700; color: #a1a1aa; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">
                      CONTEXTUAL MEETING INTELLIGENCE
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 32px 32px;">
              <h1 class="text-heading" style="font-size: 24px; font-weight: 800; color: #09090b; margin: 0 0 16px 0; letter-spacing: -0.5px; line-height: 1.3;">
                {heading}
              </h1>
              
              <p class="text-body" style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 16px 0;">
                Hi {greeting_name},
              </p>

              <p class="text-body" style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 24px 0;">
                {intro_text}
              </p>

              <!-- OTP Visual Focal Box -->
              <table role="presentation" width="100%" class="otp-container" style="background-color: #f8f9fa; border: 1px solid #e2e4e8; border-radius: 10px; margin: 24px 0 24px 0;">
                <tr>
                  <td style="padding: 24px 20px; text-align: center;">
                    <div class="otp-val" style="font-family: 'JetBrains Mono', SFMono-Regular, Consolas, 'Courier New', monospace; font-size: 34px; font-weight: 800; color: #09090b; letter-spacing: 6px; margin: 0; line-height: 1;">
                      {formatted_otp}
                    </div>
                    <div class="otp-subtext" style="font-size: 13px; font-weight: 600; color: #6b7280; margin-top: 10px;">
                      This verification code expires in <strong>{expire_mins} minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <p class="text-body" style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
                {action_note}
              </p>

              <!-- Security Warning -->
              <table role="presentation" width="100%">
                <tr>
                  <td class="security-border" style="border-top: 1px solid #eeeeee; padding-top: 20px; font-size: 13px; line-height: 1.5; color: #6b7280;">
                    If you didn't request this verification code, you can safely ignore this email. No changes will be made to your account.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer-container" style="background-color: #f8f9fa; border-top: 1px solid #eeeeee; padding: 24px 32px; text-align: center; font-size: 12px; color: #9ca3af; line-height: 1.6;">
              <strong style="color: #6b7280;">CMIS · Contextual Meeting Intelligence System</strong><br>
              This is an automated security notification. Please do not reply directly to this email.<br>
              &copy; 2026 CMIS. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return subject, plain_text, html_text


async def send_otp_email(
    to_email: str,
    otp: str,
    purpose: str = "verify",
    user_name: Optional[str] = None
) -> None:
    """
    Send a 6-digit OTP transactional email (HTML + Plain text) to the given email address.
    purpose: 'verify' | 'reset'
    """
    subject, plain_text, html_text = _generate_email_content(to_email, otp, purpose, user_name)
    formatted_otp = f"{otp[:3]} {otp[3:]}" if len(otp) == 6 else otp

    # ── Dev fallback mode when no SMTP host is configured ───────────────────
    if not settings.smtp_host or settings.smtp_host == "localhost":
        logger.info(
            "[DEV MODE] Email OTP for %s (%s): %s", to_email, purpose, otp
        )
        print(f"\n==================================================")
        print(f" [CMIS EMAIL VERIFICATION]")
        print(f" To:      {to_email}")
        print(f" Subject: {subject}")
        print(f" OTP:     {formatted_otp}")
        print(f" Expires: {settings.otp_expire_minutes} minutes")
        print(f"==================================================\n")
        return

    # ── Production mode: Send via SMTP with MIMEMultipart ────────────────────
    try:
        import aiosmtplib

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = settings.smtp_from or "CMIS <noreply@cmis.ai>"
        msg["To"]      = to_email

        part_text = MIMEText(plain_text, "plain", "utf-8")
        part_html = MIMEText(html_text, "html", "utf-8")
        msg.attach(part_text)
        msg.attach(part_html)

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
        logger.info("OTP verification email sent successfully to %s", to_email)
    except Exception as exc:
        logger.error("Failed to send OTP email to %s via SMTP: %s", to_email, exc)
        print(f"\n==================================================")
        print(f" [CMIS EMAIL VERIFICATION FALLBACK]")
        print(f" To:      {to_email}")
        print(f" Subject: {subject}")
        print(f" OTP:     {formatted_otp}")
        print(f" Expires: {settings.otp_expire_minutes} minutes")
        print(f"==================================================\n")
