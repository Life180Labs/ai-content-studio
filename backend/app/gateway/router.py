"""
AI Gateway Router — Smart multi-provider routing with fallback and retry.

Usage:
    gateway = AIGateway(preferences)
    response = await gateway.generate(prompt, system_prompt=..., task="content")
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from app.gateway.base import (
    AIAuthenticationError,
    AIProvider,
    AIProviderError,
    AIRateLimitError,
    AIResponse,
    PROVIDER_MODELS,
)
from app.gateway.providers.anthropic import AnthropicProvider
from app.gateway.providers.gemini import GeminiProvider
from app.gateway.providers.heygen import HeyGenProvider
from app.gateway.providers.openai import OpenAIProvider

logger = structlog.get_logger("gateway")

# Registry maps provider name -> provider class
PROVIDER_REGISTRY: dict[str, type[AIProvider]] = {
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "heygen": HeyGenProvider,
}


class AIGateway:
    """Smart AI gateway with fallback and retry logic.

    Routes requests to the configured primary provider.
    On failure, applies the user's fallback strategy (retry or switch model).
    """

    def __init__(
        self,
        *,
        provider_keys: dict[str, str],
        default_provider: str = "gemini",
        default_model: str | None = None,
        fallback_enabled: bool = False,
        fallback_action: str = "retry",  # "retry" | "switch_model"
        fallback_provider: str | None = None,
        fallback_model: str | None = None,
        retry_count: int = 2,
        task_overrides: dict[str, dict[str, str]] | None = None,
        custom_models: dict[str, list[str]] | None = None,
    ):
        self.provider_keys = provider_keys
        self.default_provider = default_provider
        self.default_model = default_model
        self.fallback_enabled = fallback_enabled
        self.fallback_action = fallback_action
        self.fallback_provider = fallback_provider
        self.fallback_model = fallback_model
        self.retry_count = retry_count
        self.task_overrides = task_overrides or {}
        self.custom_models = custom_models or {}
        self._provider_cache: dict[str, AIProvider] = {}

    def _get_provider(self, provider_name: str) -> AIProvider:
        """Get or create a provider instance."""
        if provider_name in self._provider_cache:
            return self._provider_cache[provider_name]

        api_key = self.provider_keys.get(provider_name)
        if not api_key:
            raise AIAuthenticationError(
                f"No API key configured for provider '{provider_name}'. "
                f"Add your {provider_name} API key in Settings.",
                provider=provider_name,
            )

        provider_cls = PROVIDER_REGISTRY.get(provider_name)
        if not provider_cls:
            raise AIProviderError(
                f"Unknown provider: '{provider_name}'",
                provider=provider_name,
            )

        provider = provider_cls(api_key=api_key)
        self._provider_cache[provider_name] = provider
        return provider

    def _resolve_provider_and_model(
        self, task: str | None
    ) -> tuple[str, str | None]:
        """Resolve which provider/model to use, considering task overrides."""
        if task and task in self.task_overrides:
            override = self.task_overrides[task]
            return (
                override.get("provider", self.default_provider),
                override.get("model", self.default_model),
            )
        return self.default_provider, self.default_model

    async def generate(
        self,
        prompt: str,
        *,
        system_prompt: str | None = None,
        task: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: str | None = None,
    ) -> AIResponse:
        """Generate text using the configured routing strategy.

        Args:
            prompt: The user prompt.
            system_prompt: Optional system/instruction prompt.
            task: Pipeline task name (e.g. "content", "script") for task overrides.
            temperature: Sampling temperature.
            max_tokens: Maximum output tokens.

        Returns:
            AIResponse with content, token usage, and cost.

        Raises:
            AIProviderError: If all attempts (primary + fallback) fail.
        """
        provider_name, model = self._resolve_provider_and_model(task)
        last_error: Exception | None = None

        # ── Primary attempt ─────────────────────────────────
        try:
            return await self._call_provider(
                provider_name, prompt,
                model=model,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
        except AIProviderError as e:
            last_error = e
            logger.warning(
                "primary_provider_failed",
                provider=provider_name,
                model=model,
                error=str(e),
            )

        if not self.fallback_enabled:
            raise last_error  # type: ignore[misc]

        # ── Fallback: Retry ─────────────────────────────────
        if self.fallback_action == "retry":
            for attempt in range(1, self.retry_count + 1):
                try:
                    logger.info(
                        "retrying_provider",
                        provider=provider_name,
                        attempt=attempt,
                        max_retries=self.retry_count,
                    )
                    await asyncio.sleep(min(attempt * 0.5, 3))  # backoff
                    return await self._call_provider(
                        provider_name, prompt,
                        model=model,
                        system_prompt=system_prompt,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        response_format=response_format,
                    )
                except AIProviderError as e:
                    last_error = e
                    logger.warning(
                        "retry_failed",
                        provider=provider_name,
                        attempt=attempt,
                        error=str(e),
                    )

        # ── Fallback: Switch Model ──────────────────────────
        if self.fallback_action == "switch_model" and self.fallback_provider:
            fb_provider = self.fallback_provider
            fb_model = self.fallback_model
            try:
                logger.info(
                    "switching_to_fallback",
                    primary_provider=provider_name,
                    fallback_provider=fb_provider,
                    fallback_model=fb_model,
                )
                return await self._call_provider(
                    fb_provider, prompt,
                    model=fb_model,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=response_format,
                )
            except AIProviderError as e:
                last_error = e
                logger.error(
                    "fallback_provider_failed",
                    provider=fb_provider,
                    error=str(e),
                )

        raise AIProviderError(
            f"All providers failed. Last error: {last_error}",
            provider=provider_name,
            model=model or "",
        )

    async def _call_provider(
        self,
        provider_name: str,
        prompt: str,
        *,
        model: str | None = None,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: str | None = None,
    ) -> AIResponse:
        """Execute a single call to a provider."""
        provider = self._get_provider(provider_name)
        response = await provider.generate(
            prompt,
            model=model,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        )

        logger.info(
            "ai_generation_complete",
            provider=response.provider,
            model=response.model,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            cost_usd=f"${response.cost_usd:.6f}",
            latency_ms=f"{response.latency_ms:.0f}",
        )

        return response

    @staticmethod
    def get_available_providers() -> dict[str, list[str]]:
        """Return all available providers and their default models."""
        return dict(PROVIDER_MODELS)
