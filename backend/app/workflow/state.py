"""
LangGraph State definition for the AI Content Studio pipeline.
"""

from typing import Annotated, Any, Sequence, TypedDict
import operator

from langchain_core.messages import BaseMessage


def merge_dicts(a: dict, b: dict) -> dict:
    """Merge two dictionaries, updating values."""
    if a is None:
        return b
    if b is None:
        return a
    res = a.copy()
    res.update(b)
    return res


class PipelineGraphState(TypedDict):
    """The state of the AI pipeline execution thread."""
    
    project_id: str
    user_id: str
    
    # ── Settings & Routing ──
    # The snapshot of AI preferences used for this run
    provider_keys: dict[str, str]
    default_provider: str
    default_model: str
    fallback_enabled: bool
    fallback_action: str
    fallback_provider: str | None
    fallback_model: str | None
    retry_count: int
    task_overrides: dict[str, dict[str, str]]
    
    # ── Pipeline Stage Data ──
    script: str  # The approved script to base the storyboard on
    
    # Simple list type without operator.add ensures we overwrite rather than append when saving new edits
    storyboard_scenes: list[dict]
    
    # Validation layer: strictly filtered scenes (included = True, deleted = False) intended for final generation
    active_scenes: list[dict]
    
    selected_voice_id: str | None
    voice_audio_paths: dict[str, str]  # scene_index -> file path
    use_custom_voice: bool
    
    selected_avatar_id: str | None
    avatar_video_ids: dict[str, str]   # scene_index -> heygen video id
    # Whether the selected avatar is an Avatar IV / custom avatar that supports
    # motion (custom_motion_prompt). Only then do we send avatar_action as motion.
    avatar_motion_enabled: bool

    aspect_ratio: str
    video_quality: str
    
    # ── Orchestration state ──
    current_node: str
    error_message: str | None
    retry_attempts: dict[str, int]  # Tracks retries per node
    
    # Langchain messages for any LLM interactions
    messages: Annotated[Sequence[BaseMessage], operator.add]
