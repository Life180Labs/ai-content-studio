"""
Redis-backed rate limiting middleware.
"""

from __future__ import annotations

import redis.asyncio as redis
import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings
from app.core.exceptions import RateLimitExceededError

logger = structlog.get_logger("rate_limit")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple sliding-window rate limiter backed by Redis."""

    def __init__(self, app, redis_client: redis.Redis | None = None):
        super().__init__(app)
        self._redis = redis_client

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            settings = get_settings()
            self._redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        settings = get_settings()

        # Skip rate limiting for health checks
        if request.url.path in ("/health", "/api/v1/health"):
            return await call_next(request)

        # Identify client by IP (or by user ID once authenticated)
        client_ip = request.client.host if request.client else "unknown"
        key = f"rate_limit:{client_ip}"

        try:
            r = await self._get_redis()
            current = await r.incr(key)
            if current == 1:
                await r.expire(key, 60)  # 60-second window

            if current > settings.RATE_LIMIT_PER_MINUTE:
                logger.warning("rate_limit_exceeded", client_ip=client_ip, count=current)
                raise RateLimitExceededError()
        except RateLimitExceededError:
            raise
        except Exception:
            # If Redis is down, allow the request through (fail-open)
            logger.warning("rate_limit_redis_error", client_ip=client_ip)

        response = await call_next(request)
        return response
