import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from .config import settings


password_hash = PasswordHash.recommended()
ALGORITHM = "HS256"
# Always verify against a hash, even for a non-existent account, so the login
# path does not reveal account existence through a faster response time.
DUMMY_PASSWORD_HASH = password_hash.hash("sentinel-dummy-password-not-a-real-account")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return password_hash.verify(password, hashed)
    except Exception:
        # A malformed legacy hash must fail closed instead of turning a bad
        # credential row into a 500 response during login or demo repair.
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, role: str, token_version: int) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    seconds = settings.access_token_minutes * 60
    payload = {
        "sub": user_id,
        "role": role,
        "ver": token_version,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=seconds),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM), seconds


def create_refresh_token(user_id: str, token_version: int, session_id: str) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=settings.refresh_token_days)
    payload = {
        "sub": user_id,
        "ver": token_version,
        "type": "refresh",
        "iat": now,
        "exp": expires,
        "jti": session_id,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM), expires


def decode_token(token: str, expected_type: str) -> dict:
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Incorrect token type")
    return payload
