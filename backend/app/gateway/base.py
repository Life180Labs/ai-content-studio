"""
AI Gateway — Base abstractions for AI providers.

Defines the AIProvider interface, AIResponse dataclass, and exception hierarchy.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


# ── Response ────────────────────────────────────────────────


@dataclass
class AIResponse:
    """Standardized response from any AI provider."""

    content: str
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


# ── Exceptions ──────────────────────────────────────────────


class AIProviderError(Exception):
    """Base exception for AI provider errors."""

    def __init__(self, message: str, provider: str = "", model: str = ""):
        self.provider = provider
        self.model = model
        super().__init__(message)


class AIRateLimitError(AIProviderError):
    """Provider rate limit exceeded."""
    pass


class AIAuthenticationError(AIProviderError):
    """Invalid or missing API key."""
    pass


class AIModelNotFoundError(AIProviderError):
    """Requested model not available."""
    pass


class AIContentFilterError(AIProviderError):
    """Content blocked by provider safety filters."""
    pass


# ── Cost Tables ─────────────────────────────────────────────

# Costs per 1M tokens (input, output) in USD
COST_TABLE: dict[str, tuple[float, float]] = {
    # Gemini
    "gemini-2.5-flash": (0.15, 0.60),
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.0-flash": (0.10, 0.40),
    # OpenAI
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    # Anthropic
    "claude-sonnet-4-20250514": (3.00, 15.00),
    "claude-haiku-4-20250514": (0.80, 4.00),
    "claude-3-5-sonnet-20241022": (3.00, 15.00),
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate the USD cost for a generation call."""
    if model not in COST_TABLE:
        return 0.0  # Unknown model — user-added custom model
    input_cost, output_cost = COST_TABLE[model]
    return (input_tokens * input_cost + output_tokens * output_cost) / 1_000_000


# ── Available Providers & Models ────────────────────────────

PROVIDER_MODELS: dict[str, list[str]] = {
    "gemini": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"],
    "anthropic": ["claude-sonnet-4-20250514", "claude-haiku-4-20250514"],
    "heygen": [],  # HeyGen is API-based for avatars/video — not text generation
}


# ── Abstract Provider ───────────────────────────────────────


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    provider_name: str = ""

    @abstractmethod
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
        """Generate text from the AI provider."""
        ...

    def _start_timer(self) -> float:
        return time.perf_counter()

    def _end_timer(self, start: float) -> float:
        return (time.perf_counter() - start) * 1000  # ms
