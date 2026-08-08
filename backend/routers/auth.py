"""
routers/auth.py — Authentication endpoints.

POST /auth/register           — Create account, send verification OTP
POST /auth/verify-email       — Submit OTP to verify email
POST /auth/resend-otp         — Resend verification OTP
POST /auth/login              — Email + password → access + refresh tokens
POST /auth/refresh            — Swap refresh token for new access token
POST /auth/logout             — Invalidate refresh token (client-side mostly)
POST /auth/forgot-password    — Send password-reset OTP
POST /auth/reset-password     — Submit OTP + new password
GET  /auth/me                 — Current user profile
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from auth.email_service import send_otp_email
from auth.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_otp,
    hash_password,
    verify_password,
)
from config import settings
from db.database import get_db
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Request / Response schemas ────────────────────────────────────────────────

class RegisterIn(BaseModel):
    name:     str       = Field(..., min_length=1, max_length=100)
    email:    EmailStr
    password: str       = Field(..., min_length=8)


class VerifyOTPIn(BaseModel):
    email: EmailStr
    otp:   str = Field(..., min_length=6, max_length=6)


class ResendOTPIn(BaseModel):
    email: EmailStr


class LoginIn(BaseModel):
    email:    EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email:        EmailStr
    otp:          str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


class TokenOut(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class UserOut(BaseModel):
    id:             str
    name:           str
    email:          str
    email_verified: bool
    created_at:     datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def _issue_tokens(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
    )


def _otp_expired(user: User) -> bool:
    if not user.otp_expires_at:
        return True
    return datetime.utcnow() > user.otp_expires_at


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=MessageOut, status_code=201)
async def register(
    body: RegisterIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new user account and send an email verification OTP."""
    email = body.email.lower()

    existing = _get_user_by_email(db, email)
    if existing:
        if existing.email_verified:
            raise HTTPException(status_code=409, detail="Email already registered.")
        # Resend OTP for unverified account
        otp = generate_otp()
        existing.otp_code       = otp
        existing.otp_expires_at = datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes)
        db.commit()
        background_tasks.add_task(send_otp_email, email, otp, "verify")
        return {"message": "Account exists but email not verified. A new OTP has been sent."}

    otp = generate_otp()
    user = User(
        name            = body.name,
        email           = email,
        password_hash   = hash_password(body.password),
        otp_code        = otp,
        otp_expires_at  = datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes),
    )
    db.add(user)
    db.commit()

    background_tasks.add_task(send_otp_email, email, otp, "verify")
    return {"message": f"Account created. A 6-digit OTP has been sent to {email}."}


@router.post("/verify-email", response_model=TokenOut)
def verify_email(body: VerifyOTPIn, db: Session = Depends(get_db)):
    """Verify email with the 6-digit OTP. Returns tokens on success."""
    user = _get_user_by_email(db, body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")
    if user.otp_code != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP.")
    if _otp_expired(user):
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

    user.email_verified = True
    user.otp_code       = None
    user.otp_expires_at = None
    db.commit()

    logger.info("User %s verified email.", user.email)
    return _issue_tokens(user)


@router.post("/resend-otp", response_model=MessageOut)
async def resend_otp(
    body: ResendOTPIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Resend a fresh verification OTP to an unverified account."""
    user = _get_user_by_email(db, body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")

    otp = generate_otp()
    user.otp_code       = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes)
    db.commit()

    background_tasks.add_task(send_otp_email, body.email.lower(), otp, "verify")
    return {"message": "A new OTP has been sent to your email."}


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Authenticate with email + password and receive JWT tokens."""
    user = _get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled.")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Check your inbox for the OTP.",
        )

    user.last_login = datetime.utcnow()
    db.commit()

    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenOut)
def refresh_token(body: RefreshIn, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access token."""
    user_id = decode_refresh_token(body.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive.")

    return _issue_tokens(user)


@router.post("/logout", response_model=MessageOut)
def logout():
    """
    Logout is primarily client-side (delete tokens from storage).
    For stateless JWTs this endpoint signals success; add a denylist here
    if you need server-side token revocation.
    """
    return {"message": "Logged out successfully."}


@router.post("/forgot-password", response_model=MessageOut)
async def forgot_password(
    body: ForgotPasswordIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Send a password-reset OTP. Always returns success to prevent user enumeration."""
    user = _get_user_by_email(db, body.email)
    if user and user.is_active:
        otp = generate_otp()
        user.otp_code       = otp
        user.otp_purposes   = "reset"
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes)
        db.commit()
        background_tasks.add_task(send_otp_email, body.email.lower(), otp, "reset")

    return {"message": "If that email is registered, you will receive a reset OTP shortly."}


@router.post("/reset-password", response_model=MessageOut)
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)):
    """Reset password using the OTP sent to the email."""
    user = _get_user_by_email(db, body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.otp_code != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP.")
    if _otp_expired(user):
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

    user.password_hash  = hash_password(body.new_password)
    user.otp_code       = None
    user.otp_expires_at = None
    user.otp_purposes   = None
    db.commit()

    return {"message": "Password updated successfully. You can now log in."}


class UpdateProfileIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.patch("/me", response_model=UserOut)
def update_profile(
    body: UpdateProfileIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's profile name."""
    current_user.name = body.name.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=MessageOut)
def change_password(
    body: ChangePasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change user password after verifying current password."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
