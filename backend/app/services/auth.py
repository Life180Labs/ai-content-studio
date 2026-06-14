"""
Auth service — registration, login, refresh, email verification.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    AuthenticationError,
    EmailAlreadyExistsError,
    EmailNotVerifiedError,
    InvalidOTPError,
    InvalidRefreshTokenError,
    NotFoundError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_password,
    hash_token,
    verify_password,
)
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.auth import TokenResponse, UserResponse
from app.services.email import send_verification_email

logger = structlog.get_logger("auth")


class AuthService:
    """Handles authentication business logic."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.token_repo = RefreshTokenRepository(session)
        self.settings = get_settings()

    async def register(
        self, email: str, password: str, full_name: str
    ) -> UserResponse:
        """Register a new user and send verification OTP."""
        # Check if email already exists
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise EmailAlreadyExistsError()

        # Generate OTP for email verification
        otp = generate_otp()
        otp_expires = datetime.now(UTC) + timedelta(minutes=15)

        # Create user
        user = await self.user_repo.create(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            is_verified=False,
            otp_code=otp,
            otp_expires_at=otp_expires.isoformat(),
        )

        # Send verification email (fire-and-forget)
        try:
            await send_verification_email(email, full_name, otp)
        except Exception:
            logger.warning("verification_email_failed", email=email)

        logger.info("user_registered", user_id=str(user.id), email=email)

        return UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            is_verified=user.is_verified,
        )

    async def verify_email(self, email: str, otp: str) -> UserResponse:
        """Verify a user's email with the OTP code."""
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise NotFoundError("No account found with this email")

        if user.is_verified:
            return UserResponse(
                id=str(user.id),
                email=user.email,
                full_name=user.full_name,
                avatar_url=user.avatar_url,
                is_active=user.is_active,
                is_verified=user.is_verified,
            )

        # Validate OTP
        if user.otp_code != otp:
            raise InvalidOTPError()

        if user.otp_expires_at:
            expires = datetime.fromisoformat(user.otp_expires_at)
            if datetime.now(UTC) > expires:
                raise InvalidOTPError("The verification code has expired")

        # Mark as verified
        user = await self.user_repo.update(
            user, is_verified=True, otp_code=None, otp_expires_at=None
        )

        logger.info("email_verified", user_id=str(user.id))

        return UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            is_verified=user.is_verified,
        )

    async def resend_otp(self, email: str) -> None:
        """Resend OTP verification code."""
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise NotFoundError("No account found with this email")

        if user.is_verified:
            return  # Silently ignore if already verified

        otp = generate_otp()
        otp_expires = datetime.now(UTC) + timedelta(minutes=15)

        await self.user_repo.update(
            user, otp_code=otp, otp_expires_at=otp_expires.isoformat()
        )

        try:
            await send_verification_email(email, user.full_name, otp)
        except Exception:
            logger.warning("resend_otp_email_failed", email=email)

    async def login(
        self, email: str, password: str, device_info: str | None = None
    ) -> TokenResponse:
        """Authenticate user and return tokens."""
        user = await self.user_repo.get_by_email(email)

        if not user or not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid email or password")

        if not user.is_active:
            raise AuthenticationError("Account is disabled")

        if not user.is_verified:
            raise EmailNotVerifiedError()

        # Generate tokens
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token()

        # Store refresh token hash
        settings = get_settings()
        await self.token_repo.create(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            device_info=device_info,
            expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )

        logger.info("user_logged_in", user_id=str(user.id))

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def refresh(self, refresh_token: str) -> TokenResponse:
        """Rotate refresh token and issue new access token."""
        token_hash = hash_token(refresh_token)
        stored_token = await self.token_repo.get_by_token_hash(token_hash)

        if not stored_token:
            raise InvalidRefreshTokenError()

        if stored_token.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
            # Revoke expired token
            await self.token_repo.update(stored_token, is_revoked=True)
            raise InvalidRefreshTokenError("Refresh token has expired")

        # Revoke old token (rotation)
        await self.token_repo.update(stored_token, is_revoked=True)

        # Issue new tokens
        access_token = create_access_token(subject=str(stored_token.user_id))
        new_refresh = create_refresh_token()

        settings = get_settings()
        await self.token_repo.create(
            user_id=stored_token.user_id,
            token_hash=hash_token(new_refresh),
            device_info=stored_token.device_info,
            expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )

        logger.info("token_refreshed", user_id=str(stored_token.user_id))

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh,
        )

    async def logout(self, user_id: uuid.UUID) -> None:
        """Revoke all refresh tokens for the user."""
        await self.token_repo.revoke_all_for_user(user_id)
        logger.info("user_logged_out", user_id=str(user_id))
