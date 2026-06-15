"""
ElevenLabs AI Provider — Voice generation.

Wraps the ElevenLabs Python SDK for generating high-quality voiceovers.
"""

from __future__ import annotations

import io
import time
from typing import Any

import structlog
from elevenlabs.client import AsyncElevenLabs
from elevenlabs.core import ApiError

from app.gateway.base import AIProvider, AIProviderError, AIResponse

logger = structlog.get_logger("gateway.elevenlabs")


class ElevenLabsProvider(AIProvider):
    """ElevenLabs AI provider for voice generation."""

    provider_name = "elevenlabs"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = AsyncElevenLabs(api_key=api_key)

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
        """ElevenLabs does not support text generation."""
        raise AIProviderError(
            "ElevenLabs is a voice generation provider and does not support text generation.",
            provider=self.provider_name,
            model=model or "",
        )

    async def generate_voice(
        self,
        text: str,
        voice_id: str = "Rachel",
        model: str = "eleven_multilingual_v2",
    ) -> tuple[bytes, dict[str, Any]]:
        """Generate voice audio from text.
        
        Returns a tuple of (audio_bytes, metadata)
        """
        start_time = time.time()
        try:
            # The AsyncElevenLabs SDK generate method returns an async generator yielding bytes
            audio_generator = await self.client.generate(
                text=text,
                voice=voice_id,
                model=model,
            )
            
            # Read all chunks
            audio_bytes = b""
            async for chunk in audio_generator:
                audio_bytes += chunk

            latency = (time.time() - start_time) * 1000

            # Calculate an estimated cost based on character count (ElevenLabs bills by character)
            char_count = len(text)
            # Example rate: $0.30 per 1000 characters
            cost = (char_count / 1000) * 0.30

            metadata = {
                "provider": self.provider_name,
                "model": model,
                "voice_id": voice_id,
                "characters": char_count,
                "latency_ms": latency,
                "cost_usd": cost,
            }

            logger.info(
                "elevenlabs_voice_generated",
                voice_id=voice_id,
                characters=char_count,
                latency_ms=latency,
            )

            return audio_bytes, metadata

        except ApiError as e:
            logger.error("elevenlabs_api_error", error=str(e))
            raise AIProviderError(
                f"ElevenLabs API Error: {str(e)}",
                provider=self.provider_name,
                model=model,
            ) from e
        except Exception as e:
            logger.exception("elevenlabs_unexpected_error")
            raise AIProviderError(
                f"Unexpected error calling ElevenLabs: {str(e)}",
                provider=self.provider_name,
                model=model,
            ) from e

    async def get_voices(self) -> list[dict[str, Any]]:
        """Fetch all available voices."""
        try:
            voices = await self.client.voices.get_all()
            result = []
            for voice in voices.voices:
                result.append({
                    "id": voice.voice_id,
                    "name": voice.name,
                    "category": voice.category,
                    "labels": voice.labels or {},
                    "preview_url": voice.preview_url,
                })
            return result
        except ApiError as e:
            logger.error("elevenlabs_get_voices_error", error=str(e))
            raise AIProviderError(f"ElevenLabs API Error: {str(e)}", provider=self.provider_name, model="") from e

    async def clone_voice(self, name: str, description: str, file_bytes: bytes, filename: str) -> dict[str, Any]:
        """Clone a voice by uploading an audio sample."""
        try:
            file_obj = io.BytesIO(file_bytes)
            file_obj.name = filename 
            
            voice = await self.client.voices.add(
                name=name,
                description=description,
                files=[file_obj]
            )
            return {
                "id": voice.voice_id,
                "name": voice.name,
            }
        except ApiError as e:
            logger.error("elevenlabs_clone_voice_error", error=str(e))
            raise AIProviderError(f"ElevenLabs API Error: {str(e)}", provider=self.provider_name, model="") from e
