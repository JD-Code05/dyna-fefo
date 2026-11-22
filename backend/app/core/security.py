from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_ph = PasswordHasher()
_ALG = "HS256"
# Verified against when the username doesn't exist, so a wrong user takes as long as a wrong password.
_DUMMY_HASH = _ph.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _ph.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def create_token(username: str, role: str, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    s = get_settings()
    claims = {"sub": username, "role": role, "iat": now, "exp": now + timedelta(hours=s.token_hours)}
    return jwt.encode(claims, s.jwt_secret, algorithm=_ALG)


def username_from_token(token: str) -> str | None:
    """The token's username, or None if it is expired, tampered with, or not ours."""
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALG])["sub"]
    except (jwt.PyJWTError, KeyError):
        return None
