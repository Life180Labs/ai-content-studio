"""
Anthropic AI Provider.
"""

from __future__ import annotations

import structlog
from anthropic import AsyncAnthropic, APIError, AuthenticationError, RateLimitError

from app.gateway.base import (
    AIAuthenticationError,
    AIContentFilterError,
    AIProvider,
    AIProviderError,
    AIRateLimitError,
    AIResponse,
    calculate_cost,
)

logger = structlog.get_logger("gateway.anthropic")


class AnthropicProvider(AIProvider):
    """Anthropic (Claude) AI provider."""

    provider_name = "anthropic"

    def __init__(self, api_key: str):
        self.client = AsyncAnthropic(api_key=api_key)

    async def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: str | None = None,
    ) -> AIResponse:
        model = model or "claude-sonnet-4-20250514"
        start = self._start_timer()

        try:
            kwargs: dict = {
                "model": model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [{"role": "user", "content": prompt}],
            }
            if system_prompt:
                kwargs["system"] = system_prompt

            response = await self.client.messages.create(**kwargs)

            latency = self._end_timer(start)

            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            content = response.content[0].text if response.content else ""

            return AIResponse(
                content=content,
                provider=self.provider_name,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=calculate_cost(model, input_tokens, output_tokens),
                latency_ms=latency,
            )

        except AuthenticationError as e:
            raise AIAuthenticationError(
                f"Anthropic authentication failed: {e}",
                provider=self.provider_name,
                model=model,
            ) from e

        except RateLimitError as e:
            raise AIRateLimitError(
                f"Anthropic rate limit exceeded: {e}",
                provider=self.provider_name,
                model=model,
            ) from e

        except APIError as e:
            raise AIProviderError(
                f"Anthropic error: {e}",
                provider=self.provider_name,
                model=model,
            ) from e

        except Exception as e:
            raise AIProviderError(
                f"Anthropic error: {e}",
                provider=self.provider_name,
                model=model,
            ) from e
