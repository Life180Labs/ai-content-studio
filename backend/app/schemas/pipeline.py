"""Pipeline Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Canvas Input (Step 1) ───────────────────────────────────


class CanvasInput(BaseModel):
    """Project canvas — all inputs for content generation."""

    topic: str = Field(..., min_length=1, max_length=500)
    key_points: list[str] = Field(default_factory=list)
    target_audience: str = Field("", max_length=255)
    goal: str = Field("", max_length=255)
    tone: str = Field("professional", max_length=100)
    length: str = Field("medium", max_length=50)  # "short" | "medium" | "long"
    platform: str = Field("youtube", max_length=100)
    call_to_action: str = Field("", max_length=500)
    brand_voice: str = Field("", max_length=1000)
    additional_context: str = Field("", max_length=2000)


class KeyPointSuggestRequest(BaseModel):
    """Request for AI-suggested key points."""

    topic: str = Field(..., min_length=1, max_length=500)
    target_audience: str = Field("", max_length=255)
    count: int = Field(5, ge=1, le=10)


class KeyPointSuggestResponse(BaseModel):
    """AI-suggested key points."""

    key_points: list[str]


# ── Content (Step 2) ────────────────────────────────────────


class ContentVariation(BaseModel):
    """A single content variation with quality metadata."""

    content: str
    quality_score: float = Field(ge=0, le=100)
    word_count: int
    tone_analysis: str = ""


class ContentResult(BaseModel):
    """Result of content generation — 2 variations."""

    variations: list[ContentVariation]
    project_id: str
    stage: str = "content"


class ContentSelectRequest(BaseModel):
    """Select a content variation to proceed."""

    selected_index: int = Field(ge=0, le=1)
    additional_context: str = Field("", max_length=2000)


# ── Script (Step 3) ─────────────────────────────────────────


class ScriptSection(BaseModel):
    """A section of the video script."""

    section_type: str  # "hook" | "intro" | "body" | "climax" | "cta" | "outro"
    text: str
    duration_estimate: str = ""
    visual_notes: str = ""


class ScriptResult(BaseModel):
    """Result of script generation."""

    sections: list[ScriptSection]
    full_script: str
    estimated_duration: str
    word_count: int
    project_id: str
    stage: str = "script"


class ScriptGenerateRequest(BaseModel):
    """Request to generate script from approved content."""

    additional_context: str = Field("", max_length=2000)


# ── Regenerate ──────────────────────────────────────────────


class RegenerateRequest(BaseModel):
    """Request to regenerate any stage."""

    stage: str = Field(..., pattern="^(content|script)$")
    additional_context: str = Field("", max_length=2000)


# ── Pipeline Status ─────────────────────────────────────────


class PipelineRunResponse(BaseModel):
    """Individual pipeline run record."""

    id: str
    stage: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: float
    status: str
    created_at: datetime


class PipelineStatusResponse(BaseModel):
    """Current pipeline state for a project."""

    project_id: str
    current_stage: int
    stage_name: str
    canvas_data: dict[str, Any] | None = None
    content_result: ContentResult | None = None
    script_result: ScriptResult | None = None
    storyboard_result: StoryboardResult | None = None
    runs: list[PipelineRunResponse] = []
    total_cost_usd: float = 0.0
    total_tokens: int = 0

# ── Storyboard (Step 4) ─────────────────────────────────────

class StoryboardScene(BaseModel):
    scene_index: int
    voice_text: str
    visual_prompt: str
    avatar_action: str
    camera_direction: str

class StoryboardResult(BaseModel):
    scenes: list[StoryboardScene]
    video_frame_size: str = "16:9"
    video_quality: str = "1080p"
    project_id: str
    stage: str = "storyboard"

class StoryboardGenerateRequest(BaseModel):
    script: str

class StoryboardSaveRequest(BaseModel):
    scenes: list[StoryboardScene]
    video_frame_size: str = "16:9"
    video_quality: str = "1080p"

class SceneRegenerateRequest(BaseModel):
    scene_index: int
    additional_context: str
    current_scene: StoryboardScene

# ── Voice (Step 5) ──────────────────────────────────────────

class VoiceGenerateRequest(BaseModel):
    selected_voice_id: str
    storyboard_scenes: list[StoryboardScene]
    video_frame_size: str = "16:9"
    video_quality: str = "1080p"

# ── Avatar (Step 6) ─────────────────────────────────────────

class AvatarGenerateRequest(BaseModel):
    selected_avatar_id: str

