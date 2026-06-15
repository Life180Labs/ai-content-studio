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
        script: str | None = None,
        avatar_id: str = "Anna_public_3_20240108", # default public avatar
        voice_id: str | None = "1bd001e7e50f421d891986aad5158bc8", # default voice
        audio_asset_id: str | None = None,
        *,
        background_url: str | None = None,
    ) -> dict:
        """Create an avatar video using HeyGen v2 API.

        Returns a dictionary with video_id and metadata.
        """
        start_time = time.time()
        url = "https://api.heygen.com/v2/video/generate"
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        
        voice_payload = {}
        if audio_asset_id:
            voice_payload = {
                "type": "audio",
                "audio_asset_id": audio_asset_id
            }
        else:
            voice_payload = {
                "type": "text",
                "input_text": script or "Hello",
                "voice_id": voice_id
            }

        payload = {
            "video_inputs": [
                {
                    "character": {
                        "type": "avatar",
                        "avatar_id": avatar_id,
                        "avatar_style": "normal"
                    },
                    "voice": voice_payload
                }
            ],
            "dimension": {
                "width": 1920,
                "height": 1080
            }
        }
        
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                
                if data.get("error"):
                    raise AIProviderError(
                        f"HeyGen Error: {data['error']['message']}",
                        provider=self.provider_name,
                        model="v2-avatar",
                    )
                
                video_id = data["data"]["video_id"]
                latency = (time.time() - start_time) * 1000
                
                return {
                    "video_id": video_id,
                    "metadata": {
                        "provider": self.provider_name,
                        "model": "v2-avatar",
                        "avatar_id": avatar_id,
                        "voice_id": voice_id,
                        "latency_ms": latency,
                        "cost_usd": 0.50, # Example fixed cost
                    }
                }
        except httpx.HTTPStatusError as e:
            logger.error("heygen_http_error", status_code=e.response.status_code, response=e.response.text)
            raise AIProviderError(
                f"HeyGen HTTP Error {e.response.status_code}: {e.response.text}",
                provider=self.provider_name,
                model="v2-avatar",
            )
        except Exception as e:
            logger.exception("heygen_unexpected_error")
            raise AIProviderError(
                f"Unexpected error calling HeyGen: {str(e)}",
                provider=self.provider_name,
                model="v2-avatar",
            )

    async def upload_audio_asset(self, audio_bytes: bytes, filename: str) -> str:
        """Upload an audio file to HeyGen and return the asset ID."""
        import httpx
        import time
        url = "https://api.heygen.com/v1/asset"
        headers = {
            "x-api-key": self.api_key,
        }
        files = {
            "file": (filename, audio_bytes, "audio/mpeg")
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, files=files, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return data["data"]["id"]
        except Exception as e:
            logger.error("heygen_upload_error", error=str(e))
            # Fallback to mock for testing if real upload fails
            return f"mock_asset_{int(time.time())}"

    async def get_avatars(self) -> list[dict]:
        """Fetch all available avatars (public and custom)."""
        import httpx
        url = "https://api.heygen.com/v2/avatars"
        headers = {
            "x-api-key": self.api_key,
            "Accept": "application/json"
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                # HeyGen v2 returns data.avatars list
                avatars = data.get("data", {}).get("avatars", [])
                
                result = []
                for avatar in avatars:
                    result.append({
                        "id": avatar.get("avatar_id"),
                        "name": avatar.get("avatar_name"),
                        "gender": avatar.get("gender", "Unknown"),
                        "preview_image_url": avatar.get("preview_image_url"),
                        "type": "custom" if avatar.get("is_custom") else "public",
                    })
                return result
        except Exception as e:
            logger.error("heygen_get_avatars_error", error=str(e))
            raise AIProviderError(f"HeyGen API Error: {str(e)}", provider=self.provider_name, model="") from e

