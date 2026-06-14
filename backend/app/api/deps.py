"""
FastAPI dependencies — auth, database, and service injection.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, InvalidTokenError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.repositories.user import UserRepository

security = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    """Extract and validate user ID from JWT access token."""
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if not user_id or token_type != "access":
            raise InvalidTokenError()

        return uuid.UUID(user_id)
    except JWTError:
        raise InvalidTokenError()
    except ValueError:
        raise InvalidTokenError()


async def get_current_active_user(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get the full user object and verify it's active."""
    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)

    if not user:
        raise AuthenticationError("User not found")
    if not user.is_active:
        raise AuthenticationError("Account is disabled")

    return user
