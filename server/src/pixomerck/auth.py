from __future__ import annotations

from fastapi import Header, HTTPException, status

from .config import Settings, invite_key


def require_invite_key(settings: Settings, header_value: str | None) -> None:
    expected = invite_key(settings)
    if not expected or header_value != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Pixomerck invite key.",
        )


def invite_header(x_pixomerck_key: str | None = Header(default=None)) -> str | None:
    return x_pixomerck_key
