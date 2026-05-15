from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
import re
import secrets
import uuid
from pathlib import Path
from typing import Any

from .config import Settings

PASSWORD_MIN_LENGTH = 8
GAMES_PBKDF2_ITERATIONS = 210_000
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
GAME_TYPES = [
    "CHESS",
    "BACKGAMMON",
    "CHECKERS",
    "CONNECT_FOUR",
    "REVERSI",
    "TIC_TAC_TOE",
    "GOMOKU",
    "MANCALA",
    "DOTS_AND_BOXES",
    "BATTLESHIP",
    "NINE_MENS_MORRIS",
]


def create_user(settings: Settings, email: str, password: str) -> dict[str, str]:
    normalized_email = normalize_email(email)
    validate_password(password)

    db = _read_games_db(settings)
    users = db.setdefault("users", [])
    if any(_normalized_email(user) == normalized_email for user in users):
        raise ValueError("That account already exists.")

    user = _games_user_record(normalized_email, password)
    users.append(user)
    db.setdefault("stats", {})[user["uid"]] = _empty_stats()
    _write_games_db(settings, db)
    return _public_user(user)


def authenticate_user(settings: Settings, email: str, password: str) -> bool:
    try:
        normalized_email = normalize_email(email)
    except ValueError:
        return False

    db = _read_games_db(settings)
    user = next((candidate for candidate in db.get("users", []) if _normalized_email(candidate) == normalized_email), None)
    if not user:
        return False
    return _verify_games_password(password, str(user.get("passwordHash", "")))


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise ValueError("Enter a valid email address.")
    return normalized


def validate_password(password: str) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Use a password with at least {PASSWORD_MIN_LENGTH} characters.")


def _read_games_db(settings: Settings) -> dict[str, Any]:
    path = settings.bored_games_db_path
    if not path.exists():
        return _empty_games_db()
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        return _empty_games_db()
    return _normalize_games_db(json.loads(text))


def _write_games_db(settings: Settings, db: dict[str, Any]) -> None:
    path = settings.bored_games_db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temp_path.write_text(f"{json.dumps(_normalize_games_db(db), indent=2)}\n", encoding="utf-8")
    temp_path.replace(path)


def _empty_games_db() -> dict[str, Any]:
    return {
        "users": [],
        "games": [],
        "stats": {},
        "bugReports": [],
        "challenges": [],
    }


def _normalize_games_db(db: dict[str, Any]) -> dict[str, Any]:
    normalized = _empty_games_db()
    normalized.update(db)
    normalized["users"] = list(normalized.get("users") or [])
    normalized["stats"] = dict(normalized.get("stats") or {})
    normalized["games"] = list(normalized.get("games") or [])
    normalized["bugReports"] = list(normalized.get("bugReports") or [])
    normalized["challenges"] = list(normalized.get("challenges") or [])
    return normalized


def _games_user_record(email: str, password: str) -> dict[str, str]:
    nickname = _default_nickname(email)
    return {
        "uid": str(uuid.uuid4()),
        "emailHash": _short_hash(email),
        "normalizedEmail": email,
        "nickname": nickname,
        "displayName": nickname,
        "passwordHash": _hash_games_password(password),
        "createdAt": _now_iso(),
    }


def _hash_games_password(password: str) -> str:
    salt = secrets.token_bytes(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        GAMES_PBKDF2_ITERATIONS,
        32,
    ).hex()
    return f"{GAMES_PBKDF2_ITERATIONS}:{salt}:{digest}"


def _verify_games_password(password: str, stored: str) -> bool:
    try:
        iterations_text, salt, expected = stored.split(":")
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            int(iterations_text),
            32,
        )
        return hmac.compare_digest(bytes.fromhex(expected), actual)
    except (TypeError, ValueError):
        return False


def _empty_stats() -> list[dict[str, int | str]]:
    return [{"gameType": game_type, "wins": 0, "losses": 0, "draws": 0, "abandoned": 0} for game_type in GAME_TYPES]


def _normalized_email(user: dict[str, Any]) -> str:
    return str(user.get("normalizedEmail", "")).strip().lower()


def _public_user(user: dict[str, Any]) -> dict[str, str]:
    return {
        "uid": str(user["uid"]),
        "email": _normalized_email(user),
        "nickname": str(user.get("nickname") or user.get("displayName") or _default_nickname(_normalized_email(user))),
        "displayName": str(user.get("displayName") or user.get("nickname") or _default_nickname(_normalized_email(user))),
    }


def _default_nickname(email: str) -> str:
    return email.split("@", maxsplit=1)[0].strip() or "Player"


def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
