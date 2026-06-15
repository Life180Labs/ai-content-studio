"""Pipeline API endpoints — Content generation pipeline."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.db.session import get_db
from app.gateway.base import AIProviderError
from app.schemas.pipeline import (
    CanvasInput,
    ContentResult,
    KeyPointSuggestRequest,
    KeyPointSuggestResponse,
    PipelineStatusResponse,
    RegenerateRequest,
    ScriptGenerateRequest,
    ScriptResult,
    StoryboardGenerateRequest,
    StoryboardResult,
    StoryboardSaveRequest,
    SceneRegenerateRequest,
    StoryboardScene,
    VoiceGenerateRequest,
    AvatarGenerateRequest,
)
from app.services.pipeline import PipelineService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/projects/{project_id}/pipeline",
    tags=["Pipeline"],
)


def _parse_uuid(value: str, name: str = "ID") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {name} format")


@router.post("/suggest-key-points", response_model=KeyPointSuggestResponse)
async def suggest_key_points(
    data: KeyPointSuggestRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """AI-suggest key points for a topic."""
    try:
        service = PipelineService(session)
        return await service.suggest_key_points(
            user_id=user_id,
            topic=data.topic,
            target_audience=data.target_audience,
            count=data.count,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/content", response_model=ContentResult)
async def generate_content(
    workspace_id: str,
    project_id: str,
    data: CanvasInput,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Generate 2 content variations from canvas data (Step 2)."""
    pid = _parse_uuid(project_id, "project_id")
    try:
        service = PipelineService(session)
        return await service.generate_content(
            user_id=user_id,
            project_id=pid,
            canvas=data,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/script", response_model=ScriptResult)
async def generate_script(
    workspace_id: str,
    project_id: str,
    data: ScriptGenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Generate a video script from approved content (Step 3)."""
    pid = _parse_uuid(project_id, "project_id")
    try:
        service = PipelineService(session)
        return await service.generate_script(
            user_id=user_id,
            project_id=pid,
            additional_context=data.additional_context,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/regenerate")
async def regenerate_stage(
    workspace_id: str,
    project_id: str,
    data: RegenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Regenerate a specific pipeline stage."""
    pid = _parse_uuid(project_id, "project_id")
    service = PipelineService(session)

    try:
        if data.stage == "content":
            # Get canvas data from project
            project = await service._get_project(pid)
            if not project.canvas_data:
                raise HTTPException(
                    status_code=400, detail="Canvas data missing. Fill out the Canvas first."
                )
            canvas = CanvasInput(**project.canvas_data)
            if data.additional_context:
                canvas.additional_context = data.additional_context
            return await service.generate_content(user_id, pid, canvas)

        elif data.stage == "script":
            return await service.generate_script(
                user_id, pid, data.additional_context
            )

        raise HTTPException(status_code=400, detail=f"Unknown stage: {data.stage}")

    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/storyboard")
async def generate_storyboard(
    workspace_id: str,
    project_id: str,
    data: StoryboardGenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Start storyboard generation background task (Step 4)."""
    pid = _parse_uuid(project_id, "project_id")
    try:
        service = PipelineService(session)
        return await service.start_storyboard(
            user_id=user_id,
            project_id=pid,
            script=data.script,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/storyboard/save", response_model=StoryboardResult)
async def save_storyboard(
    workspace_id: str,
    project_id: str,
    data: StoryboardSaveRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Manually save storyboard edits as a draft."""
    pid = _parse_uuid(project_id, "project_id")
    service = PipelineService(session)
    return await service.save_storyboard(
        user_id=user_id,
        project_id=pid,
        scenes=data.scenes,
        video_frame_size=data.video_frame_size,
        video_quality=data.video_quality,
    )

@router.post("/storyboard/regenerate-scene", response_model=StoryboardScene)
async def regenerate_storyboard_scene(
    workspace_id: str,
    project_id: str,
    data: SceneRegenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Regenerate a single storyboard scene."""
    pid = _parse_uuid(project_id, "project_id")
    try:
        service = PipelineService(session)
        return await service.regenerate_scene(
            user_id=user_id,
            project_id=pid,
            scene_index=data.scene_index,
            current_scene=data.current_scene,
            additional_context=data.additional_context,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/voice")
async def generate_voice(
    workspace_id: str,
    project_id: str,
    data: VoiceGenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Start voice generation background task (Step 5)."""
    pid = _parse_uuid(project_id, "project_id")
    try:
        service = PipelineService(session)
        return await service.start_voice(
            user_id=user_id,
            project_id=pid,
            voice_id=data.selected_voice_id,
            storyboard_scenes=data.storyboard_scenes,
            video_frame_size=data.video_frame_size,
            video_quality=data.video_quality,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/avatar")
async def generate_avatar(
    workspace_id: str,
    project_id: str,
    data: AvatarGenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Start avatar generation background task (Step 6)."""
    pid = _parse_uuid(project_id, "project_id")
    try:
        service = PipelineService(session)
        return await service.start_avatar(
            user_id=user_id,
            project_id=pid,
            avatar_id=data.selected_avatar_id,
            use_custom_voice=data.use_custom_voice,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.get("/status", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    workspace_id: str,
    project_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get the current pipeline state for a project."""
    pid = _parse_uuid(project_id, "project_id")
    service = PipelineService(session)
    return await service.get_status(pid)

@router.get("/videos/status", response_model=VideoResult)
async def check_video_status(
    workspace_id: str,
    project_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Poll HeyGen API for video progress."""
    pid = _parse_uuid(project_id, "project_id")
    service = PipelineService(session)
    result = await service.check_video_status(user_id=user_id, project_id=pid)
    if not result:
        raise HTTPException(status_code=404, detail="No video generation found for this project.")
    return result
