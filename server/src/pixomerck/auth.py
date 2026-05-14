from __future__ import annotations

import base64
from dataclasses import dataclass
import hashlib
import hmac
import secrets
import time

from fastapi import Cookie, Header, HTTPException, status

from .config import Settings, invite_key

SESSION_COOKIE = "pixomerck_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30


@dataclass(frozen=True)
class AuthCredentials:
    header_value: str | None
    session_token: str | None


def require_invite_key(settings: Settings, credentials: AuthCredentials | str | None) -> None:
    if isinstance(credentials, AuthCredentials):
        if is_valid_session_token(settings, credentials.session_token):
            return
        header_value = credentials.header_value
    else:
        header_value = credentials

    if _is_valid_invite_key(settings, header_value):
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Pixomerck invite key.",
    )


def auth_credentials(
    x_pixomerck_key: str | None = Header(default=None),
    pixomerck_session: str | None = Cookie(default=None),
) -> AuthCredentials:
    return AuthCredentials(header_value=x_pixomerck_key, session_token=pixomerck_session)


def create_session_token(settings: Settings) -> str:
    created_at = str(int(time.time()))
    nonce = secrets.token_urlsafe(16)
    payload = f"{created_at}.{nonce}"
    return f"{payload}.{_signature(settings, payload)}"


def is_valid_session_token(settings: Settings, token: str | None) -> bool:
    if not token:
        return False

    parts = token.split(".")
    if len(parts) != 3:
        return False

    created_at, nonce, signature = parts
    if not created_at.isdigit() or not nonce:
        return False

    age = time.time() - int(created_at)
    if age < 0 or age > SESSION_MAX_AGE_SECONDS:
        return False

    payload = f"{created_at}.{nonce}"
    return hmac.compare_digest(signature, _signature(settings, payload))


def _is_valid_invite_key(settings: Settings, value: str | None) -> bool:
    expected = invite_key(settings)
    if not expected or value is None:
        return False
    return hmac.compare_digest(value, expected)


def _signature(settings: Settings, payload: str) -> str:
    digest = hmac.new(invite_key(settings).encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
