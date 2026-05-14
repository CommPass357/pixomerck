from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from pathlib import Path
from typing import Any

from .config import Settings

PASSWORD_MIN_LENGTH = 8
PBKDF2_ITERATIONS = 390_000
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_user(settings: Settings, email: str, password: str) -> dict[str, str]:
    normalized_email = normalize_email(email)
    validate_password(password)

    users = _read_users(settings)
    if normalized_email in users:
        raise ValueError("That account already exists.")

    users[normalized_email] = _password_record(password)
    _write_users(settings, users)
    return {"email": normalized_email}


def authenticate_user(settings: Settings, email: str, password: str) -> bool:
    try:
        normalized_email = normalize_email(email)
    except ValueError:
        return False
    users = _read_users(settings)
    record = users.get(normalized_email)
    if not record:
        return False

    salt = _decode(record.get("salt", ""))
    expected = _decode(record.get("hash", ""))
    iterations = int(record.get("iterations", PBKDF2_ITERATIONS))
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise ValueError("Enter a valid email address.")
    return normalized


def validate_password(password: str) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Use a password with at least {PASSWORD_MIN_LENGTH} characters.")


def _password_record(password: str) -> dict[str, Any]:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return {
        "hash": _encode(digest),
        "salt": _encode(salt),
        "iterations": PBKDF2_ITERATIONS,
        "created_at": int(time.time()),
    }


def _read_users(settings: Settings) -> dict[str, dict[str, Any]]:
    path = _users_path(settings)
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_users(settings: Settings, users: dict[str, dict[str, Any]]) -> None:
    path = _users_path(settings)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(users, indent=2, sort_keys=True), encoding="utf-8")
    temp_path.replace(path)


def _users_path(settings: Settings) -> Path:
    return settings.data_dir / "users.json"


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
