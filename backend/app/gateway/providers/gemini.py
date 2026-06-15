"""
Google Gemini AI Provider.
"""

from __future__ import annotations

import structlog
from google import genai
from google.genai import types

from app.gateway.base import (
    AIAuthenticationError,
    AIContentFilterError,
    AIProvider,
    AIProviderError,
    AIResponse,
    calculate_cost,
)

logger = structlog.get_logger("gateway.gemini")


class GeminiProvider(AIProvider):
    """Google Gemini AI provider."""

    provider_name = "gemini"

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

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
        model = model or "gemini-2.5-flash"
        start = self._start_timer()

        try:
            config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            )
            if system_prompt:
                config.system_instruction = system_prompt

            response = self.client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )

            latency = self._end_timer(start)

            # Extract token counts from usage metadata
            input_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
            output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

            content = response.text or ""

            return AIResponse(
                content=content,
                provider=self.provider_name,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=calculate_cost(model, input_tokens, output_tokens),
                latency_ms=latency,
            )

        except Exception as e:
            latency = self._end_timer(start)
            error_msg = str(e)

            if "API_KEY" in error_msg.upper() or "PERMISSION" in error_msg.upper():
                raise AIAuthenticationError(
                    f"Gemini authentication failed: {error_msg}",
                    provider=self.provider_name,
                    model=model,
                ) from e

            if "SAFETY" in error_msg.upper() or "BLOCKED" in error_msg.upper():
                raise AIContentFilterError(
                    f"Content blocked by Gemini safety filters: {error_msg}",
                    provider=self.provider_name,
                    model=model,
                ) from e

            raise AIProviderError(
                f"Gemini error: {error_msg}",
                provider=self.provider_name,
                model=model,
            ) from e
