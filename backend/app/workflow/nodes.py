"""
LangGraph Nodes for the AI Content Studio pipeline.
"""

from __future__ import annotations

import json
import uuid

import structlog
from langchain_core.messages import AIMessage, HumanMessage

from app.gateway.base import AIProviderError
from app.gateway.router import AIGateway
from app.workflow.state import PipelineGraphState

logger = structlog.get_logger("workflow.nodes")


def _get_gateway(state: PipelineGraphState) -> AIGateway:
    """Build the AI Gateway from the state snapshot."""
    return AIGateway(
        provider_keys=state["provider_keys"],
        default_provider=state["default_provider"],
        default_model=state["default_model"],
        fallback_enabled=state["fallback_enabled"],
        fallback_action=state["fallback_action"],
        fallback_provider=state["fallback_provider"],
        fallback_model=state["fallback_model"],
        retry_count=state["retry_count"],
        task_overrides=state.get("task_overrides") or {},
    )


async def generate_storyboard(state: PipelineGraphState) -> dict:
    """Node: Convert the script into a storyboard with visual prompts."""
    logger.info("node_start", node="generate_storyboard", project_id=state["project_id"])
    gateway = _get_gateway(state)
    script = state.get("script", "")

    if not script:
        return {"error_message": "No script provided to storyboard node."}

    system_prompt = """You are an expert video director. Convert the following video script into a structured storyboard.
CRITICAL: No single scene should cross the 8-second time limit. Therefore, the "voice_text" for EACH scene MUST NOT exceed 50 words. Break the script down into smaller, faster-paced scenes if necessary.

Return ONLY valid JSON with this structure:
{
  "scenes": [
    {
      "scene_index": 1,
      "voice_text": "The exact spoken text for this scene (max 50 words).",
      "visual_prompt": "A highly detailed image generation prompt describing the scene.",
      "avatar_action": "Describe what the AI avatar is doing (e.g., pointing, smiling).",
      "camera_direction": "e.g., Close-up, Zoom in, Pan right"
    }
  ]
}"""

    prompt = f"Convert this script into a storyboard:\n\n{script}"

    try:
        response = await gateway.generate(
            prompt,
            system_prompt=system_prompt,
            task="storyboard",
            temperature=0.7,
            response_format="json"
        )

        text = response.content.strip()
        
        import re
        match = re.search(r'```(?:json)?(.*?)```', text, re.DOTALL)
        if match:
            text = match.group(1).strip()
        else:
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            import json_repair
            try:
                # Use json_repair to robustly fix truncated or malformed JSON from the LLM
                data = json_repair.loads(text)
            except Exception as e:
                logger.error("json_decode_error", raw_text=text, error=str(e))
                return {"error_message": f"Failed to parse JSON: {str(e)}", "current_node": "generate_storyboard"}

        scenes = data.get("scenes", [])
        
        return {
            "storyboard_scenes": scenes,
            "current_node": "generate_storyboard",
            "error_message": None,
        }

    except AIProviderError as e:
        logger.error("storyboard_generation_error", error=str(e))
        return {"error_message": str(e), "current_node": "generate_storyboard"}


async def generate_assets(state: PipelineGraphState) -> dict:
    """Node: Generate avatar videos for each scene using HeyGen built-in TTS."""
    logger.info("node_start", node="generate_assets", project_id=state["project_id"])

    from app.gateway.providers.heygen import HeyGenProvider

    keys = state.get("provider_keys", {})
    hg_key = keys.get("heygen")

    if not hg_key:
        return {"error_message": "HeyGen API key is missing. Add it in Settings.", "current_node": "generate_assets"}

    avatar_provider = HeyGenProvider(api_key=hg_key)

    # Optional: image generation for scene backgrounds
    gateway = _get_gateway(state)
    default_provider_name = gateway.default_provider
    try:
        image_provider = gateway._get_provider(default_provider_name)
    except Exception:
        image_provider = None

    scenes = state.get("storyboard_scenes", [])
    voice_id = state.get("selected_voice_id") or ""
    avatar_id = state.get("selected_avatar_id") or "Anna_public_3_20240108"
    # Only custom / Avatar IV avatars support motion prompts (avatar_action).
    motion_enabled = state.get("avatar_motion_enabled", False)

    aspect_ratio = state.get("aspect_ratio", "16:9")
    video_quality = state.get("video_quality", "production")

    if aspect_ratio == "9:16":
        dimension = {"width": 1080, "height": 1920}
    elif aspect_ratio == "1:1":
        dimension = {"width": 1080, "height": 1080}
    else:
        dimension = {"width": 1920, "height": 1080}

    test_mode = video_quality == "draft"

    video_ids = state.get("avatar_video_ids", {})

    try:
        active_scenes = [
            s for s in scenes
            if s.get("included", True) and not s.get("deleted", False)
        ]

        for scene in active_scenes:
            idx = scene.get("scene_index", scenes.index(scene))
            text = scene.get("voice_text", "").strip()
            if not text:
                continue

            # Optional: AI-generated background image. Falls back to a neutral
            # studio color (not a green screen) if image generation is unavailable.
            background = {"type": "color", "value": "#1F2937"}
            visual_prompt = scene.get("visual_prompt")
            if visual_prompt and image_provider and hasattr(image_provider, "generate_image"):
                try:
                    size = "1024x1024" if aspect_ratio == "1:1" else "1920x1080"
                    img_bytes = await image_provider.generate_image(prompt=visual_prompt, size=size)
                    bg_asset_id = await avatar_provider.upload_asset(img_bytes, "image/png")
                    background = {"type": "image", "asset_id": bg_asset_id}
                except Exception as e:
                    logger.warning("background_generation_failed", scene=idx, error=str(e))

            # avatar_action → HeyGen Avatar IV motion prompt (custom avatars only).
            motion_prompt = None
            if motion_enabled:
                action = (scene.get("avatar_action") or "").strip()
                motion_prompt = action or None

            # HeyGen handles TTS internally — pass voice_text + voice_id
            logger.info("generating_avatar_video", scene=idx, avatar_id=avatar_id, voice_id=voice_id, motion=bool(motion_prompt))
            result = await avatar_provider.create_avatar_video(
                script=text,
                avatar_id=avatar_id,
                voice_id=voice_id or None,
                dimension=dimension,
                test_mode=test_mode,
                background=background,
                motion_prompt=motion_prompt,
            )

            video_ids[str(idx)] = {"video_id": result["video_id"], "status": "processing"}
            logger.info("video_queued", scene=idx, video_id=result["video_id"])

        return {
            "voice_audio_paths": {},
            "avatar_video_ids": video_ids,
            "current_node": "generate_assets",
            "error_message": None,
        }
    except Exception as e:
        logger.error("assets_generation_error", error=str(e))
        return {"error_message": str(e), "current_node": "generate_assets"}
