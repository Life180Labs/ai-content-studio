"""
HeyGen AI Provider — Video generation & avatar creation.

HeyGen is not a text generation provider; it handles avatar video rendering.
This provider wraps the HeyGen API for the Video pipeline stage (Phase 3+).
For Phase 2, this is a placeholder that registers the provider for key storage.
"""

from __future__ import annotations

import structlog

from app.gateway.base import AIProvider, AIProviderError, AIResponse

logger = structlog.get_logger("gateway.heygen")


class HeyGenProvider(AIProvider):
    """HeyGen AI provider for avatar video generation."""

    provider_name = "heygen"

    def __init__(self, api_key: str):
        self.api_key = api_key

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
        """HeyGen does not support text generation — it's for video/avatar.

        This method will be extended in Phase 3 for video rendering.
        """
        raise AIProviderError(
            "HeyGen is a video generation provider and does not support text generation. "
            "Use Gemini, OpenAI, or Anthropic for content/script generation.",
            provider=self.provider_name,
            model=model or "",
        )

    async def create_avatar_video(
        self,
        script: str,
        avatar_id: str,
        voice_id: str,
        *,
        background_url: str | None = None,
    ) -> dict:
        """Create an avatar video (Phase 3 implementation).

        Returns a task ID for polling the video status.
        """
        # Phase 3: implement HeyGen v2 API call
        raise NotImplementedError("HeyGen video generation is planned for Phase 3")
