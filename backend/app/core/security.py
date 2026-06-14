"""
Security utilities — JWT tokens, password hashing, and AES encryption.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# ── Password Hashing ────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password with bcrypt (cost factor 12)."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT Tokens ──────────────────────────────────────────────


def create_access_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token."""
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> str:
    """Create a cryptographically random refresh token."""
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    """SHA-256 hash a token for safe database storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token. Raises JWTError on failure."""
    settings = get_settings()
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP code for email verification."""
    return "".join([str(secrets.randbelow(10)) for _ in range(length)])


# ── AES Encryption (for API keys at rest) ───────────────────


def _get_fernet() -> Fernet:
    """Get a Fernet instance from the configured encryption key."""
    settings = get_settings()
    # Ensure the key is valid Fernet key (32 url-safe base64-encoded bytes)
    key = settings.ENCRYPTION_KEY
    if len(key) < 32:
        # Derive a proper key from the configured secret
        derived = hashlib.sha256(key.encode()).digest()
        key = base64.urlsafe_b64encode(derived).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string value (e.g., API key) for database storage."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a stored encrypted value."""
    return _get_fernet().decrypt(ciphertext.encode()).decode()
