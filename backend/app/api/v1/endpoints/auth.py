"""Auth API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResendOTPRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    data: RegisterRequest,
    session: AsyncSession = Depends(get_db),
):
    """Register a new user account. Sends OTP verification email."""
    service = AuthService(session)
    return await service.register(
        email=data.email,
        password=data.password,
        full_name=data.full_name,
    )


@router.post("/verify-email", response_model=UserResponse)
async def verify_email(
    data: VerifyEmailRequest,
    session: AsyncSession = Depends(get_db),
):
    """Verify email address using OTP code."""
    service = AuthService(session)
    return await service.verify_email(email=data.email, otp=data.otp)


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(
    data: ResendOTPRequest,
    session: AsyncSession = Depends(get_db),
):
    """Resend OTP verification code."""
    service = AuthService(session)
    await service.resend_otp(email=data.email)
    return MessageResponse(message="If the email exists, a new code has been sent")


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    """Login with email and password. Returns access and refresh tokens."""
    service = AuthService(session)
    device_info = request.headers.get("User-Agent")
    return await service.login(
        email=data.email,
        password=data.password,
        device_info=device_info,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db),
):
    """Exchange a refresh token for a new access + refresh token pair."""
    service = AuthService(session)
    return await service.refresh(refresh_token=data.refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Revoke all refresh tokens for the current user."""
    service = AuthService(session)
    await service.logout(user_id)
    return MessageResponse(message="Successfully logged out")


@router.get("/me", response_model=UserResponse)
async def get_me(
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get current authenticated user's profile."""
    from app.repositories.user import UserRepository

    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("User not found")

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        is_verified=user.is_verified,
    )
