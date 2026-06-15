"""
OpenAI AI Provider.
"""

from __future__ import annotations

import structlog
from openai import AsyncOpenAI, APIError, AuthenticationError, RateLimitError

from app.gateway.base import (
    AIAuthenticationError,
    AIContentFilterError,
    AIProvider,
    AIProviderError,
    AIRateLimitError,
    AIResponse,
    calculate_cost,
)

logger = structlog.get_logger("gateway.openai")


class OpenAIProvider(AIProvider):
    """OpenAI AI provider."""

    provider_name = "openai"

    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)

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
        model = model or "gpt-4o-mini"
        start = self._start_timer()

        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format == "json":
                kwargs["response_format"] = { "type": "json_object" }

            response = await self.client.chat.completions.create(**kwargs)

            latency = self._end_timer(start)

            usage = response.usage
            input_tokens = usage.prompt_tokens if usage else 0
            output_tokens = usage.completion_tokens if usage else 0
            content = response.choices[0].message.content or ""

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
                f"OpenAI authentication failed: {e}",
                provider=self.provider_name,
                model=model,
            ) from e

        except RateLimitError as e:
            raise AIRateLimitError(
                f"OpenAI rate limit exceeded: {e}",
                provider=self.provider_name,
                model=model,
            ) from e

        except APIError as e:
            error_msg = str(e)
            if "content_filter" in error_msg.lower():
                raise AIContentFilterError(
                    f"Content blocked by OpenAI: {error_msg}",
                    provider=self.provider_name,
                    model=model,
                ) from e

            raise AIProviderError(
                f"OpenAI error: {error_msg}",
                provider=self.provider_name,
                model=model,
            ) from e

        except Exception as e:
            raise AIProviderError(
                f"OpenAI error: {e}",
                provider=self.provider_name,
                model=model,
            ) from e
