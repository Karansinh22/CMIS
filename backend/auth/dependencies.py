"""
auth/dependencies.py — FastAPI dependency for authenticated routes.

Usage:
    @router.get("/protected")
    def protected(current_user: User = Depends(get_current_user)):
        ...
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.security import decode_access_token
from db.database import get_db
from db.models import User
from sqlalchemy.orm import Session

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Raise 401 if the Bearer token is missing, invalid, or the user doesn't exist."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise exc

    payload = decode_access_token(creds.credentials)
    if payload is None:
        raise exc

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise exc

    return user


def get_verified_user(user: User = Depends(get_current_user)) -> User:
    """Like get_current_user but also requires email_verified=True."""
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified. Check your inbox for the OTP.",
        )
    return user


def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """Returns User if valid Bearer token provided, otherwise None."""
    if creds is None:
        return None
    payload = decode_access_token(creds.credentials)
    if payload is None:
        return None
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    return user if (user and user.is_active) else None
