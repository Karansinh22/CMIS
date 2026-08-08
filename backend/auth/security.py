"""
auth/security.py — JWT token creation & verification, password hashing.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
import bcrypt

from config import settings

# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    # Truncate to max 72 bytes as required by bcrypt specification
    password_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        password_bytes = plain.encode("utf-8")[:72]
        hashed_bytes = hashed.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


# ── JWT ───────────────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + expires_delta
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, email: str) -> str:
    return _create_token(
        {"sub": user_id, "email": email, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_access_token(token: str) -> Optional[dict]:
    """Return payload dict or None on any failure."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[str]:
    """Return user_id (sub) or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
    except JWTError:
        return None
