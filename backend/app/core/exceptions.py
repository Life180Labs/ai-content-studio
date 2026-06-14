"""
Custom exception hierarchy and FastAPI exception handlers.

All domain exceptions inherit from AppException so they can be caught
by a single global handler and returned as structured JSON errors.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


# ── Base Exception ──────────────────────────────────────────


class AppException(Exception):
    """Base application exception with structured error response."""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred"

    def __init__(
        self,
        message: str | None = None,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ):
        self.message = message or self.__class__.message
        self.details = details or []
        self.headers = headers
        super().__init__(self.message)


# ── Auth Exceptions ─────────────────────────────────────────


class AuthenticationError(AppException):
    status_code = 401
    error_code = "AUTHENTICATION_ERROR"
    message = "Could not validate credentials"


class InvalidTokenError(AuthenticationError):
    error_code = "INVALID_TOKEN"
    message = "The provided token is invalid or expired"


class TokenExpiredError(AuthenticationError):
    error_code = "TOKEN_EXPIRED"
    message = "The token has expired"


class InvalidRefreshTokenError(AuthenticationError):
    error_code = "INVALID_REFRESH_TOKEN"
    message = "The refresh token is invalid or has been revoked"


# ── Authorization Exceptions ───────────────────────────────


class ForbiddenError(AppException):
    status_code = 403
    error_code = "FORBIDDEN"
    message = "You do not have permission to perform this action"


class InsufficientRoleError(ForbiddenError):
    error_code = "INSUFFICIENT_ROLE"
    message = "Your role does not have sufficient permissions"


# ── Resource Exceptions ─────────────────────────────────────


class NotFoundError(AppException):
    status_code = 404
    error_code = "NOT_FOUND"
    message = "The requested resource was not found"


class ConflictError(AppException):
    status_code = 409
    error_code = "CONFLICT"
    message = "The request conflicts with existing data"


class EmailAlreadyExistsError(ConflictError):
    error_code = "EMAIL_ALREADY_EXISTS"
    message = "An account with this email already exists"


# ── Validation Exceptions ──────────────────────────────────


class ValidationError(AppException):
    status_code = 422
    error_code = "VALIDATION_ERROR"
    message = "The request data is invalid"


# ── Rate Limiting ───────────────────────────────────────────


class RateLimitExceededError(AppException):
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"
    message = "Too many requests. Please try again later"


# ── Email Verification ──────────────────────────────────────


class EmailNotVerifiedError(AppException):
    status_code = 403
    error_code = "EMAIL_NOT_VERIFIED"
    message = "Please verify your email address before continuing"


class InvalidOTPError(AppException):
    status_code = 400
    error_code = "INVALID_OTP"
    message = "The verification code is invalid or has expired"


# ── Exception Handlers ──────────────────────────────────────


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.error_code,
                    "message": exc.message,
                    "details": exc.details,
                },
                "meta": {
                    "request_id": getattr(request.state, "request_id", None),
                },
            },
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Log the real error (will be handled by logging middleware)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "details": [],
                },
                "meta": {
                    "request_id": getattr(request.state, "request_id", None),
                },
            },
        )
