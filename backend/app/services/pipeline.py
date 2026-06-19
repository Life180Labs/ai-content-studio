"""
Pipeline Service — Content generation pipeline (Steps 1-3).

Orchestrates AI calls for Canvas → Content → Script stages.
"""

from __future__ import annotations

import json
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.gateway.base import AIProviderError
from app.gateway.router import AIGateway
from app.models.pipeline_run import PipelineRun
from app.models.project import Project
from app.repositories.ai_preference import AIPreferenceRepository
from app.schemas.pipeline import (
    CanvasInput,
    ContentResult,
    ContentVariation,
    KeyPointSuggestResponse,
    PipelineRunResponse,
    PipelineStatusResponse,
    ScriptResult,
    ScriptSection,
    StoryboardResult,
    StoryboardScene,
    VoiceResult,
    VideoResult,
    VideoStatus,
)
from app.services.ai_preference import AIPreferenceService

logger = structlog.get_logger("pipeline")

# ── Stage mapping ───────────────────────────────────────────

STAGE_MAP = {
    "canvas": 0,
    "content": 1,
    "script": 2,
    "storyboard": 3,
    "voice": 4,
    "avatar": 5,
    "video": 6,
    "delivery": 7,
}


class PipelineService:
    """Orchestrates the content generation pipeline."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def _get_gateway(self, user_id: uuid.UUID) -> AIGateway:
        """Build an AIGateway configured with the user's preferences."""
        pref_repo = AIPreferenceRepository(self.session)
        pref_service = AIPreferenceService(self.session)
        pref = await pref_repo.get_by_user_id(user_id)

        if not pref:
            raise AIProviderError(
                "No AI provider configured. Go to Settings → AI Provider Keys to add your API keys.",
                provider="",
            )

        keys = pref_service.get_decrypted_keys(pref)
        if not keys:
            raise AIProviderError(
                "No API keys found. Go to Settings → AI Provider Keys to add your API keys.",
                provider="",
            )

        return AIGateway(
            provider_keys=keys,
            default_provider=pref.default_provider,
            default_model=pref.default_model,
            fallback_enabled=pref.fallback_enabled,
            fallback_action=pref.fallback_action,
            fallback_provider=pref.fallback_provider,
            fallback_model=pref.fallback_model,
            retry_count=pref.retry_count,
            task_overrides=pref.task_overrides or {},
            custom_models=pref.custom_models or {},
        )

    async def _get_project(self, project_id: uuid.UUID, workspace_id: uuid.UUID) -> Project:
        """Fetch a project by ID and Workspace ID to ensure isolation."""
        stmt = select(Project).where(
            Project.id == project_id, 
            Project.workspace_id == workspace_id,
            Project.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        project = result.scalar_one_or_none()
        if not project:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Project not found")
        return project

    async def _save_run(
        self,
        project_id: uuid.UUID,
        stage: str,
        input_data: dict,
        output_data: dict,
        response,
        status: str = "success",
        error_message: str | None = None,
    ) -> PipelineRun:
        """Persist a pipeline run record."""
        run = PipelineRun(
            project_id=project_id,
            stage=stage,
            input_data=input_data,
            output_data=output_data,
            provider=getattr(response, "provider", ""),
            model=getattr(response, "model", ""),
            input_tokens=getattr(response, "input_tokens", 0),
            output_tokens=getattr(response, "output_tokens", 0),
            cost_usd=getattr(response, "cost_usd", 0.0),
            latency_ms=getattr(response, "latency_ms", 0.0),
            status=status,
            error_message=error_message,
        )
        self.session.add(run)
        await self.session.flush()
        return run

    # ── Key Point Suggestion ────────────────────────────────

    async def suggest_key_points(
        self,
        user_id: uuid.UUID,
        topic: str,
        target_audience: str = "",
        count: int = 5,
    ) -> KeyPointSuggestResponse:
        """Use AI to suggest key points for a topic."""
        gateway = await self._get_gateway(user_id)

        prompt = f"""Generate exactly {count} compelling key points for a video about:

Topic: {topic}
{f"Target Audience: {target_audience}" if target_audience else ""}

Return ONLY a JSON array of strings, no other text. Example:
["Key point 1", "Key point 2", "Key point 3"]"""

        response = await gateway.generate(
            prompt,
            system_prompt="You are a content strategist. Return ONLY valid JSON.",
            task="content",
            temperature=0.8,
            max_tokens=1024,
        )

        try:
            # Parse the JSON array from the response
            text = response.content.strip()
            # Handle markdown code blocks
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            points = json.loads(text)
            if not isinstance(points, list):
                points = [str(points)]
        except (json.JSONDecodeError, IndexError):
            # Fallback: split by newlines
            points = [
                line.strip().lstrip("0123456789.-) ")
                for line in response.content.strip().split("\n")
                if line.strip() and not line.strip().startswith("[")
            ][:count]

        return KeyPointSuggestResponse(key_points=points[:count])

    # ── Content Generation (Step 2) ─────────────────────────

    async def generate_content(
        self,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        project_id: uuid.UUID,
        canvas: CanvasInput,
    ) -> ContentResult:
        """Generate 2 content variations from canvas data."""
        project = await self._get_project(project_id, workspace_id)
        gateway = await self._get_gateway(user_id)

        # Save canvas data to project
        project.canvas_data = canvas.model_dump()
        project.current_stage = STAGE_MAP["content"]
        await self.session.flush()

        system_prompt = """You are an expert content creator. Generate high-quality, engaging content for video production.
Your content should be well-structured, compelling, and tailored to the specified audience and platform."""

        prompt = self._build_content_prompt(canvas)

        variations: list[ContentVariation] = []

        for i in range(2):
            try:
                response = await gateway.generate(
                    prompt + f"\n\nGenerate VARIATION {i + 1} — make it distinctly different from other variations.",
                    system_prompt=system_prompt,
                    task="content",
                    temperature=0.8 + (i * 0.1),  # Slightly different temp for variety
                    max_tokens=4096,
                )

                content_text = response.content
                word_count = len(content_text.split())

                # Generate quality score
                score = await self._score_content(gateway, content_text, canvas)

                variations.append(
                    ContentVariation(
                        content=content_text,
                        quality_score=score,
                        word_count=word_count,
                        tone_analysis=canvas.tone,
                    )
                )

                # Save run
                await self._save_run(
                    project_id=project_id,
                    stage="content",
                    input_data=canvas.model_dump(),
                    output_data={
                        "variation_index": i,
                        "content": content_text,
                        "quality_score": score,
                        "word_count": word_count,
                    },
                    response=response,
                )

            except AIProviderError as e:
                await self._save_run(
                    project_id=project_id,
                    stage="content",
                    input_data=canvas.model_dump(),
                    output_data={},
                    response=e,
                    status="error",
                    error_message=str(e),
                )
                raise

        logger.info(
            "content_generated",
            project_id=str(project_id),
            variations=len(variations),
        )

        return ContentResult(
            variations=variations,
            project_id=str(project_id),
        )

    async def _score_content(
        self, gateway: AIGateway, content: str, canvas: CanvasInput
    ) -> float:
        """AI-rate the content quality (0-100)."""
        try:
            prompt = f"""Rate the following content on a scale of 0-100 based on:
- Relevance to topic: "{canvas.topic}"
- Engagement and readability
- Tone match: "{canvas.tone}"
- Audience fit: "{canvas.target_audience}"

Content:
{content[:2000]}

Return ONLY a number between 0 and 100, nothing else."""

            response = await gateway.generate(
                prompt,
                system_prompt="You are a content quality evaluator. Return ONLY a number.",
                task="content",
                temperature=0.3,
                max_tokens=10,
            )

            score = float(response.content.strip().rstrip("."))
            return max(0, min(100, score))
        except Exception:
            return 75.0  # Default score on failure

    def _build_content_prompt(self, canvas: CanvasInput) -> str:
        """Build the content generation prompt from canvas data."""
        parts = [f"Create compelling video content about: {canvas.topic}"]

        if canvas.key_points:
            points = "\n".join(f"- {kp}" for kp in canvas.key_points)
            parts.append(f"\nKey points to cover:\n{points}")

        if canvas.target_audience:
            parts.append(f"\nTarget audience: {canvas.target_audience}")
        if canvas.goal:
            parts.append(f"\nGoal: {canvas.goal}")
        if canvas.tone:
            parts.append(f"\nTone: {canvas.tone}")
        if canvas.length:
            length_guide = {"short": "2-3 minutes", "medium": "5-7 minutes", "long": "10-15 minutes"}
            parts.append(f"\nTarget length: {length_guide.get(canvas.length, canvas.length)}")
        if canvas.platform:
            parts.append(f"\nPlatform: {canvas.platform}")
        if canvas.call_to_action:
            parts.append(f"\nCall to action: {canvas.call_to_action}")
        if canvas.brand_voice:
            parts.append(f"\nBrand voice: {canvas.brand_voice}")
        if canvas.additional_context:
            parts.append(f"\nAdditional context: {canvas.additional_context}")

        parts.append(
            "\n\nWrite the full content in a natural, engaging style. "
            "Structure it with clear sections suitable for video narration."
        )

        return "\n".join(parts)

    # ── Script Generation (Step 3) ──────────────────────────

    async def generate_script(
        self,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        project_id: uuid.UUID,
        additional_context: str = "",
        selected_variation_index: int = 0,
    ) -> ScriptResult:
        """Generate a video script from the approved content."""
        project = await self._get_project(project_id, workspace_id)
        gateway = await self._get_gateway(user_id)

        # Get the latest approved content
        stmt = (
            select(PipelineRun)
            .where(
                PipelineRun.project_id == project_id,
                PipelineRun.stage == "content",
                PipelineRun.status == "success",
            )
            .order_by(PipelineRun.created_at.desc())
            .limit(4)
        )
        result = await self.session.execute(stmt)
        content_runs = result.scalars().all()

        if not content_runs:
            from app.core.exceptions import ValidationError
            raise ValidationError("No content generated yet. Complete the Content stage first.")

        # Use the run whose variation_index matches the user's selection
        content_text = ""
        for run in content_runs:
            if run.output_data.get("variation_index") == selected_variation_index:
                content_text = run.output_data.get("content", "")
                break
        if not content_text:
            content_text = content_runs[0].output_data.get("content", "")

        system_prompt = """You are an expert video scriptwriter. Convert content into a structured video script.

Return your script as valid JSON with this exact structure:
{
  "sections": [
    {"section_type": "hook", "text": "...", "duration_estimate": "15s", "visual_notes": "..."},
    {"section_type": "intro", "text": "...", "duration_estimate": "30s", "visual_notes": "..."},
    {"section_type": "body", "text": "...", "duration_estimate": "2m", "visual_notes": "..."},
    {"section_type": "climax", "text": "...", "duration_estimate": "45s", "visual_notes": "..."},
    {"section_type": "cta", "text": "...", "duration_estimate": "20s", "visual_notes": "..."},
    {"section_type": "outro", "text": "...", "duration_estimate": "15s", "visual_notes": "..."}
  ],
  "estimated_duration": "5m 30s"
}"""

        prompt = f"""Convert the following content into a professional video script:

{content_text}

{f"Additional direction: {additional_context}" if additional_context else ""}

Create a complete script with hook, intro, body, climax, CTA, and outro sections.
Include visual notes for each section describing what the viewer should see.
Return ONLY valid JSON."""

        try:
            response = await gateway.generate(
                prompt,
                system_prompt=system_prompt,
                task="script",
                temperature=0.7,
                max_tokens=8192,
            )

            # Parse the script JSON
            text = response.content.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            script_data = json.loads(text)
            sections = [
                ScriptSection(**s) for s in script_data.get("sections", [])
            ]
            full_script = "\n\n".join(
                f"[{s.section_type.upper()}]\n{s.text}" for s in sections
            )
            word_count = len(full_script.split())

            # Update project stage
            project.current_stage = STAGE_MAP["script"]
            await self.session.flush()

            # Save run
            await self._save_run(
                project_id=project_id,
                stage="script",
                input_data={"content": content_text[:500], "additional_context": additional_context},
                output_data=script_data,
                response=response,
            )

            logger.info("script_generated", project_id=str(project_id))

            return ScriptResult(
                sections=sections,
                full_script=full_script,
                estimated_duration=script_data.get("estimated_duration", ""),
                word_count=word_count,
                project_id=str(project_id),
            )

        except json.JSONDecodeError:
            # If JSON parsing fails, treat the entire response as a raw script
            sections = [
                ScriptSection(
                    section_type="body",
                    text=response.content,
                    duration_estimate="",
                    visual_notes="",
                )
            ]
            await self._save_run(
                project_id=project_id,
                stage="script",
                input_data={"content": content_text[:500]},
                output_data={"raw_script": response.content},
                response=response,
            )

            project.current_stage = STAGE_MAP["script"]
            await self.session.flush()

            return ScriptResult(
                sections=sections,
                full_script=response.content,
                estimated_duration="",
                word_count=len(response.content.split()),
                project_id=str(project_id),
            )

        except AIProviderError as e:
            await self._save_run(
                project_id=project_id,
                stage="script",
                input_data={"content": content_text[:500]},
                output_data={},
                response=e,
                status="error",
                error_message=str(e),
            )
            raise

    # ── Pipeline Status ─────────────────────────────────────

    async def get_status(
        self, project_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> PipelineStatusResponse:
        """Get the current pipeline state for a project."""
        project = await self._get_project(project_id, workspace_id)

        stage_names = {v: k for k, v in STAGE_MAP.items()}
        stage_name = stage_names.get(project.current_stage, "canvas")

        # Get all runs
        stmt = (
            select(PipelineRun)
            .where(PipelineRun.project_id == project_id)
            .order_by(PipelineRun.created_at.desc())
        )
        result = await self.session.execute(stmt)
        runs = result.scalars().all()

        run_responses = [
            PipelineRunResponse(
                id=str(r.id),
                stage=r.stage,
                provider=r.provider,
                model=r.model,
                input_tokens=r.input_tokens,
                output_tokens=r.output_tokens,
                cost_usd=r.cost_usd,
                latency_ms=r.latency_ms,
                status=r.status,
                created_at=r.created_at,
            )
            for r in runs
        ]

        total_cost = sum(r.cost_usd for r in runs if r.status == "success")
        total_tokens = sum(
            r.input_tokens + r.output_tokens for r in runs if r.status == "success"
        )

        # Reconstruct content result from runs
        content_result = None
        content_runs = [r for r in runs if r.stage == "content" and r.status == "success"]
        if content_runs:
            variations = []
            for cr in sorted(content_runs, key=lambda x: x.created_at):
                od = cr.output_data or {}
                variations.append(
                    ContentVariation(
                        content=od.get("content", ""),
                        quality_score=od.get("quality_score", 0),
                        word_count=od.get("word_count", 0),
                        tone_analysis=od.get("tone_analysis", ""),
                    )
                )
            content_result = ContentResult(
                variations=variations[-2:],  # Last 2 variations
                project_id=str(project_id),
            )

        # Reconstruct script result
        script_result = None
        script_runs = [r for r in runs if r.stage == "script" and r.status == "success"]
        if script_runs:
            sr = script_runs[0]  # Most recent
            od = sr.output_data or {}
            sections = [ScriptSection(**s) for s in od.get("sections", [])]
            full_script = od.get("raw_script", "") or "\n\n".join(
                f"[{s.section_type.upper()}]\n{s.text}" for s in sections
            )
            script_result = ScriptResult(
                sections=sections,
                full_script=full_script,
                estimated_duration=od.get("estimated_duration", ""),
                word_count=len(full_script.split()),
                project_id=str(project_id),
            )

        # Reconstruct storyboard result
        storyboard_result = None
        storyboard_runs = [r for r in runs if r.stage == "storyboard" and r.status == "success"]
        if storyboard_runs:
            sr = storyboard_runs[0]
            od = sr.output_data or {}
            scenes = [StoryboardScene(**s) for s in od.get("scenes", [])]
            storyboard_result = StoryboardResult(
                scenes=scenes,
                video_frame_size=od.get("video_frame_size", "16:9"),
                video_quality=od.get("video_quality", "1080p"),
                project_id=str(project_id)
            )

        # Reconstruct voice result
        voice_result = None
        voice_runs = [r for r in runs if r.stage == "voice" and r.status == "success"]
        if voice_runs:
            sr = voice_runs[0]
            od = sr.output_data or {}
            voice_result = VoiceResult(
                audio_paths=od.get("audio_paths", {}),
                project_id=str(project_id)
            )

        # Reconstruct video result
        video_result = None
        video_runs = [r for r in runs if r.stage == "video" and r.status == "success"]
        if video_runs:
            sr = video_runs[0]
            od = sr.output_data or {}
            videos = {k: VideoStatus(**v) if isinstance(v, dict) else VideoStatus(video_id=str(v), status="pending") for k, v in od.get("videos", {}).items()}
            video_result = VideoResult(
                videos=videos,
                project_id=str(project_id)
            )

        return PipelineStatusResponse(
            project_id=str(project_id),
            current_stage=project.current_stage,
            stage_name=stage_name,
            content_result=content_result,
            script_result=script_result,
            storyboard_result=storyboard_result,
            voice_result=voice_result,
            video_result=video_result,
            runs=run_responses,
            total_cost_usd=total_cost,
            total_tokens=total_tokens,
        )

    # ── Phase 3: LangGraph Background Tasks ─────────────────

    async def start_storyboard(self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID, script: str) -> dict:
        """Trigger Celery task to run LangGraph for storyboard generation."""
        from app.workflow.tasks import start_storyboard_generation
        project = await self._get_project(project_id, workspace_id)
        project.current_stage = STAGE_MAP["storyboard"]
        await self.session.flush()
        
        # Celery .delay() to enqueue the task
        task = start_storyboard_generation.delay(str(project_id), str(user_id), script)
        return {"task_id": task.id, "status": "processing"}

    async def save_storyboard(
        self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID, scenes: list[StoryboardScene], video_frame_size: str, video_quality: str
    ) -> StoryboardResult:
        """Manually save storyboard edits as a successful run without invoking AI."""
        # Ensure project exists
        project = await self._get_project(project_id, workspace_id)
        project.current_stage = STAGE_MAP["storyboard"]
        await self.session.flush()

        await self._save_run(
            project_id=project_id,
            stage="storyboard",
            input_data={"manual_edit": True},
            output_data={
                "scenes": [s.model_dump() for s in scenes],
                "video_frame_size": video_frame_size,
                "video_quality": video_quality
            },
            response=None,
            status="success"
        )
        return StoryboardResult(
            scenes=scenes,
            video_frame_size=video_frame_size,
            video_quality=video_quality,
            project_id=str(project_id)
        )

    async def regenerate_scene(
        self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID, scene_index: int, current_scene: StoryboardScene, additional_context: str
    ) -> StoryboardScene:
        """Regenerate a single storyboard scene."""
        project = await self._get_project(project_id, workspace_id)
        gateway = await self._get_gateway(user_id)

        system_prompt = """You are an expert video director. You are rewriting a SINGLE scene of a storyboard.
Return the updated scene as valid JSON with this exact structure:
{
  "voice_text": "...",
  "visual_prompt": "...",
  "avatar_action": "...",
  "camera_direction": "..."
}
Return ONLY valid JSON."""

        prompt = f"""Here is the current scene:
Spoken Script: {current_scene.voice_text}
Visual Prompt: {current_scene.visual_prompt}
Avatar Action: {current_scene.avatar_action}
Camera Direction: {current_scene.camera_direction}

Please rewrite this scene based on the following feedback/context:
{additional_context}

Make sure the spoken script matches the tone, but incorporate the new changes.
Keep the visual prompt descriptive and cinematic."""

        response = await gateway.generate(
            prompt,
            system_prompt=system_prompt,
            task="script",
            temperature=0.7,
            max_tokens=1024,
        )

        try:
            text = response.content.strip()
            if text.startswith("```"):
                text = text.split("\\n", 1)[1].rsplit("```", 1)[0].strip()

            scene_data = json.loads(text)
            
            updated_scene = StoryboardScene(
                scene_index=scene_index,
                voice_text=scene_data.get("voice_text", current_scene.voice_text),
                visual_prompt=scene_data.get("visual_prompt", current_scene.visual_prompt),
                avatar_action=scene_data.get("avatar_action", current_scene.avatar_action),
                camera_direction=scene_data.get("camera_direction", current_scene.camera_direction),
            )
            return updated_scene
        except Exception as e:
            logger.error("regenerate_scene_error", error=str(e), content=response.content)
            raise AIProviderError("Failed to parse regenerated scene. Please try again.")

    async def regenerate_script_section(
        self,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        project_id: uuid.UUID,
        section_index: int,
        current_section: ScriptSection,
        additional_context: str = "",
    ) -> ScriptSection:
        """Regenerate a single script section with AI."""
        await self._get_project(project_id, workspace_id)
        gateway = await self._get_gateway(user_id)

        system_prompt = """You are an expert video scriptwriter. Rewrite a SINGLE section of a video script.
Return the updated section as valid JSON with this exact structure:
{
  "text": "...",
  "visual_notes": "..."
}
Return ONLY valid JSON. Keep section_type and duration_estimate unchanged."""

        prompt = f"""Current script section ({current_section.section_type.upper()}):
Text: {current_section.text}
Visual Notes: {current_section.visual_notes}

Rewrite the text based on: {additional_context or "Improve clarity and engagement."}

Return ONLY valid JSON."""

        response = await gateway.generate(
            prompt,
            system_prompt=system_prompt,
            task="script",
            temperature=0.7,
            max_tokens=2048,
        )

        try:
            text = response.content.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            data = json.loads(text)
            return ScriptSection(
                section_type=current_section.section_type,
                text=data.get("text", current_section.text),
                duration_estimate=current_section.duration_estimate,
                visual_notes=data.get("visual_notes", current_section.visual_notes),
            )
        except Exception as e:
            logger.error("regenerate_section_error", error=str(e))
            raise AIProviderError("Failed to parse regenerated section. Please try again.")

    async def start_assets(
        self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID,
        voice_id: str, avatar_id: str, use_custom_voice: bool = True,
        storyboard_scenes: list[StoryboardScene] | None = None,
        video_frame_size: str = "16:9",
        video_quality: str = "1080p",
        avatar_motion_enabled: bool = False,
    ) -> dict:
        """Trigger Celery task to run LangGraph for voice and avatar generation."""
        from app.workflow.tasks import start_assets_generation
        project = await self._get_project(project_id, workspace_id)
        # Once asset generation starts, the user belongs on the Video Review tab.
        # Advance to "video" (6) so that tab is unlocked and a page reload lands
        # there (STAGE_NAMES[6] == "video-review"), instead of bouncing back to
        # Voice & Avatar (stage 5).
        project.current_stage = STAGE_MAP["video"]
        
        # Save the confirmed storyboard edits to the run history
        if storyboard_scenes:
            await self._save_run(
                project_id=project_id,
                stage="storyboard",
                input_data={"manual_edit": True},
                output_data={
                    "scenes": [s.model_dump() for s in storyboard_scenes],
                    "video_frame_size": video_frame_size,
                    "video_quality": video_quality
                },
                response=None,
                status="success"
            )

        await self.session.flush()
        
        scenes_dicts = [s.model_dump() for s in storyboard_scenes] if storyboard_scenes else None
        video_settings = {
            "frame_size": video_frame_size,
            "quality": video_quality,
            "motion_enabled": avatar_motion_enabled,
        }

        task = start_assets_generation.delay(
            str(project_id), str(user_id), voice_id, avatar_id, 
            use_custom_voice, scenes_dicts, video_settings
        )
        return {"task_id": task.id, "status": "processing"}

    async def check_video_status(self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID) -> VideoResult | None:
        """Poll HeyGen API for the latest video statuses and update DB."""
        # Ensure project isolation
        await self._get_project(project_id, workspace_id)
        # 1. Fetch latest Video PipelineRun
        stmt = (
            select(PipelineRun)
            .where(PipelineRun.project_id == project_id)
            .where(PipelineRun.stage == "video")
            .where(PipelineRun.status == "success")
            .order_by(PipelineRun.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        run = result.scalar_one_or_none()
        if not run or not run.output_data or "videos" not in run.output_data:
            return None

        videos_dict = run.output_data["videos"]
        gateway = await self._get_gateway(user_id)
        heygen_key = gateway.provider_keys.get("heygen")
        if not heygen_key:
            return VideoResult(videos={k: VideoStatus(**v) if isinstance(v, dict) else VideoStatus(video_id=str(v), status="failed", error_message="Missing HeyGen API key") for k, v in videos_dict.items()}, project_id=str(project_id))

        import httpx
        updated = False
        new_videos_dict = {}

        async with httpx.AsyncClient() as client:
            headers = {"x-api-key": heygen_key}
            for scene_idx, v_data in videos_dict.items():
                # If it's just a string, it's the raw video_id from previous implementation
                if isinstance(v_data, str):
                    v_data = {"video_id": v_data, "status": "pending"}
                
                vid = v_data.get("video_id")
                status = v_data.get("status")
                
                if status in ["completed", "failed"] or not vid:
                    new_videos_dict[scene_idx] = v_data
                    continue
                
                try:
                    url = f"https://api.heygen.com/v1/video_status.get?video_id={vid}"
                    resp = await client.get(url, headers=headers, timeout=10.0)
                    resp.raise_for_status()
                    data = resp.json()
                    
                    if data["code"] == 100:
                        v_data["status"] = data["data"]["status"] # pending, processing, completed, failed
                        if v_data["status"] == "completed":
                            v_data["video_url"] = data["data"]["video_url"]
                        elif v_data["status"] == "failed":
                            v_data["error_message"] = data["data"].get("error", "Unknown error")
                        updated = True
                except Exception as e:
                    logger.error("check_video_status_error", error=str(e), video_id=vid)
                
                new_videos_dict[scene_idx] = v_data

        if updated:
            run.output_data["videos"] = new_videos_dict
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(run, "output_data")
            await self.session.commit()

        videos = {k: VideoStatus(**v) for k, v in new_videos_dict.items()}
        return VideoResult(videos=videos, project_id=str(project_id))

    async def get_voices(self, user_id: uuid.UUID) -> list[dict]:
        """Get list of available voices from HeyGen."""
        gateway = await self._get_gateway(user_id)
        hg_key = gateway.provider_keys.get("heygen")
        if not hg_key:
            raise AIProviderError("HeyGen API key not configured.", provider="heygen", model="")

        from app.gateway.providers.heygen import HeyGenProvider
        provider = HeyGenProvider(api_key=hg_key)
        return await provider.get_voices()

    async def clone_voice(
        self, user_id: uuid.UUID, name: str, description: str, file_bytes: bytes, filename: str
    ) -> dict:
        """Clone a voice using HeyGen (requires Enterprise account)."""
        gateway = await self._get_gateway(user_id)
        hg_key = gateway.provider_keys.get("heygen")
        if not hg_key:
            raise AIProviderError("HeyGen API key not configured.", provider="heygen", model="")

        from app.gateway.providers.heygen import HeyGenProvider
        provider = HeyGenProvider(api_key=hg_key)
        result = await provider.clone_voice(name, description, file_bytes, filename)
        return {"id": result["voice_id"], "name": name}

    async def merge_scene_videos(self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID) -> dict:
        """Download all scene videos from HeyGen and merge them using moviepy."""
        import os
        import httpx
        from moviepy import VideoFileClip, concatenate_videoclips
        import asyncio

        project = await self._get_project(project_id, workspace_id)
        video_result = await self.check_video_status(user_id, workspace_id, project_id)
        
        if not video_result or not video_result.videos:
            raise ValueError("No videos found to merge.")

        os.makedirs("storage/video", exist_ok=True)
        downloaded_paths = []

        async with httpx.AsyncClient() as client:
            for idx in sorted(video_result.videos.keys(), key=lambda x: int(x)):
                status_info = video_result.videos[idx]
                if status_info.status != "completed" or not status_info.video_url:
                    raise ValueError(f"Video for scene {idx} is not completed or missing URL.")
                
                out_path = f"storage/video/{project_id}_scene_{idx}.mp4"
                if not os.path.exists(out_path):
                    resp = await client.get(status_info.video_url, timeout=60.0)
                    resp.raise_for_status()
                    with open(out_path, "wb") as f:
                        f.write(resp.content)
                downloaded_paths.append(out_path)

        final_path = f"storage/video/{project_id}_final.mp4"
        
        # Run moviepy merge in a thread so it doesn't block the async event loop
        def _merge_videos(paths, out_file):
            clips = []
            try:
                clips = [VideoFileClip(p) for p in paths]
                final_clip = concatenate_videoclips(clips, method="compose")
                final_clip.write_videofile(out_file, codec="libx264", audio_codec="aac")
            finally:
                for c in clips:
                    try:
                        c.close()
                    except:
                        pass
                        
        await asyncio.to_thread(_merge_videos, downloaded_paths, final_path)

        project.current_stage = STAGE_MAP["delivery"]
        await self.session.commit()
        return {"status": "success", "file_path": final_path}

    async def get_final_video_path(self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID) -> str:
        """Return the path to the merged final video, ensuring project isolation."""
        import os

        await self._get_project(project_id, workspace_id)
        final_path = f"storage/video/{project_id}_final.mp4"
        if not os.path.exists(final_path):
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Final video not generated yet. Merge the approved scenes first.")
        return final_path

    async def generate_project_package(self, user_id: uuid.UUID, workspace_id: uuid.UUID, project_id: uuid.UUID) -> str:
        """Generate a ZIP file containing the script, storyboard, audio, and final video."""
        import os
        import zipfile
        import json
        
        project = await self._get_project(project_id, workspace_id)
        
        # Fetch storyboard
        stmt = select(PipelineRun).where(PipelineRun.project_id == project_id, PipelineRun.stage == "storyboard", PipelineRun.status == "success").order_by(PipelineRun.created_at.desc()).limit(1)
        res = await self.session.execute(stmt)
        storyboard_run = res.scalar_one_or_none()
        
        os.makedirs("storage/packages", exist_ok=True)
        zip_path = f"storage/packages/{project_id}_package.zip"
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            if storyboard_run and storyboard_run.output_data:
                # Write script
                if storyboard_run.input_data and "script" in storyboard_run.input_data:
                    zipf.writestr("script.txt", storyboard_run.input_data["script"])
                
                # Write storyboard JSON
                zipf.writestr("storyboard.json", json.dumps(storyboard_run.output_data.get("scenes", []), indent=2))
                
            # Add audio files if they exist
            audio_dir = "storage/audio"
            if os.path.exists(audio_dir):
                for f in os.listdir(audio_dir):
                    if f.startswith(str(project_id)):
                        zipf.write(os.path.join(audio_dir, f), arcname=f"audio/{f}")
                        
            # Add video files if they exist
            video_dir = "storage/video"
            if os.path.exists(video_dir):
                final_vid = f"{project_id}_final.mp4"
                if os.path.exists(os.path.join(video_dir, final_vid)):
                    zipf.write(os.path.join(video_dir, final_vid), arcname=f"video/final_video.mp4")
                    
        return zip_path
