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
Return ONLY valid JSON with this structure:
{
  "scenes": [
    {
      "scene_index": 1,
      "voice_text": "The exact spoken text for this scene.",
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
            max_tokens=4096,
        )

        text = response.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        data = json.loads(text)
        scenes = data.get("scenes", [])
        
        return {
            "storyboard_scenes": scenes,
            "current_node": "generate_storyboard",
            "error_message": None,
        }

    except AIProviderError as e:
        logger.error("storyboard_generation_error", error=str(e))
        return {"error_message": str(e), "current_node": "generate_storyboard"}
    except json.JSONDecodeError:
        return {"error_message": "Failed to parse JSON from AI response.", "current_node": "generate_storyboard"}


async def generate_voice(state: PipelineGraphState) -> dict:
    """Node: Generate voice audio for each storyboard scene."""
    logger.info("node_start", node="generate_voice", project_id=state["project_id"])
    
    # In a real setup, we'd use the gateway to route to ElevenLabs
    # For now, we simulate this as the ElevenLabs provider is added
    from app.gateway.providers.elevenlabs import ElevenLabsProvider
    
    keys = state.get("provider_keys", {})
    el_key = keys.get("elevenlabs")
    
    if not el_key:
        return {"error_message": "ElevenLabs API key is missing. Add it in Settings."}
        
    provider = ElevenLabsProvider(api_key=el_key)
    scenes = state.get("storyboard_scenes", [])
    voice_id = state.get("selected_voice_id", "Rachel")
    
    audio_paths = {}
    
    try:
        for idx, scene in enumerate(scenes):
            text = scene.get("voice_text", "")
            if not text.strip():
                continue
                
            audio_bytes, metadata = await provider.generate_voice(text, voice_id=voice_id)
            
            # Save audio locally for phase 3 testing
            import os
            os.makedirs("storage/audio", exist_ok=True)
            path = f"storage/audio/{state['project_id']}_scene_{idx}.mp3"
            with open(path, "wb") as f:
                f.write(audio_bytes)
                
            audio_paths[str(idx)] = path
            
        return {
            "voice_audio_paths": audio_paths,
            "current_node": "generate_voice",
            "error_message": None,
        }
    except Exception as e:
        logger.error("voice_generation_error", error=str(e))
        return {"error_message": str(e), "current_node": "generate_voice"}


async def generate_avatar_video(state: PipelineGraphState) -> dict:
    """Node: Generate avatar video using HeyGen for each scene."""
    logger.info("node_start", node="generate_avatar_video", project_id=state["project_id"])
    
    from app.gateway.providers.heygen import HeyGenProvider
    
    keys = state.get("provider_keys", {})
    hg_key = keys.get("heygen")
    
    if not hg_key:
        return {"error_message": "HeyGen API key is missing. Add it in Settings."}
        
    provider = HeyGenProvider(api_key=hg_key)
    scenes = state.get("storyboard_scenes", [])
    avatar_id = state.get("selected_avatar_id", "Anna_public_3_20240108")
    voice_id = state.get("selected_voice_id", "1bd001e7e50f421d891986aad5158bc8") # HeyGen voice map
    
    video_ids = {}
    
    try:
        for idx, scene in enumerate(scenes):
            script = scene.get("voice_text", "")
            if not script.strip():
                continue
                
            result = await provider.create_avatar_video(
                script=script,
                avatar_id=avatar_id,
                voice_id=voice_id,
            )
            
            video_ids[str(idx)] = result["video_id"]
            
        return {
            "avatar_video_ids": video_ids,
            "current_node": "generate_avatar_video",
            "error_message": None,
        }
    except Exception as e:
        logger.error("avatar_generation_error", error=str(e))
        return {"error_message": str(e), "current_node": "generate_avatar_video"}
