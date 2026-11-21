from __future__ import annotations

import hmac
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import settings

_password_hash = PasswordHash.recommended()

ACCESS_TOKEN_LIFETIME = timedelta(hours=12)
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def create_access_token(account_id: uuid.UUID, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(account_id),
        "role": role,
        "iat": now,
        "exp": now + ACCESS_TOKEN_LIFETIME,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


class InvalidToken(Exception):
    pass


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise InvalidToken from exc


def is_admin_key(candidate: str | None) -> bool:
    if not candidate:
        return False
    return hmac.compare_digest(candidate, settings.admin_api_key)


def is_service_key(candidate: str | None) -> bool:
    if not candidate:
        return False
    return hmac.compare_digest(candidate, settings.service_api_key)
