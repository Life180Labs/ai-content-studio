"""Pipeline API endpoints — Content generation pipeline."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import FileResponse
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
    ScriptSection,
    ScriptSectionRegenerateRequest,
    StoryboardGenerateRequest,
    StoryboardResult,
    StoryboardSaveRequest,
    SceneRegenerateRequest,
    StoryboardScene,
    VoiceAvatarGenerateRequest,
    VideoResult,
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
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        return await service.generate_content(
            user_id=user_id,
            workspace_id=wid,
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
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        return await service.generate_script(
            user_id=user_id,
            workspace_id=wid,
            project_id=pid,
            additional_context=data.additional_context,
            selected_variation_index=data.selected_variation_index,
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
    wid = _parse_uuid(workspace_id, "workspace_id")
    service = PipelineService(session)

    try:
        if data.stage == "content":
            # Get canvas data from project
            project = await service._get_project(pid, wid)
            if not project.canvas_data:
                raise HTTPException(
                    status_code=400, detail="Canvas data missing. Fill out the Canvas first."
                )
            canvas = CanvasInput(**project.canvas_data)
            if data.additional_context:
                canvas.additional_context = data.additional_context
            return await service.generate_content(user_id, wid, pid, canvas)

        elif data.stage == "script":
            return await service.generate_script(
                user_id, wid, pid, data.additional_context,
                selected_variation_index=data.selected_variation_index,
            )

        raise HTTPException(status_code=400, detail=f"Unknown stage: {data.stage}")

    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/script/regenerate-section", response_model=ScriptSection)
async def regenerate_script_section(
    workspace_id: str,
    project_id: str,
    data: ScriptSectionRegenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Regenerate a single script section with AI guidance."""
    pid = _parse_uuid(project_id, "project_id")
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        return await service.regenerate_script_section(
            user_id=user_id,
            workspace_id=wid,
            project_id=pid,
            section_index=data.section_index,
            current_section=data.current_section,
            additional_context=data.additional_context,
        )
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
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        return await service.start_storyboard(
            user_id=user_id,
            workspace_id=wid,
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
    wid = _parse_uuid(workspace_id, "workspace_id")
    service = PipelineService(session)
    return await service.save_storyboard(
        user_id=user_id,
        workspace_id=wid,
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
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        return await service.regenerate_scene(
            user_id=user_id,
            workspace_id=wid,
            project_id=pid,
            scene_index=data.scene_index,
            current_scene=data.current_scene,
            additional_context=data.additional_context,
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/assets")
async def generate_assets(
    workspace_id: str,
    project_id: str,
    data: VoiceAvatarGenerateRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Start voice and avatar generation background task (Step 5)."""
    pid = _parse_uuid(project_id, "project_id")
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        return await service.start_assets(
            user_id=user_id,
            workspace_id=wid,
            project_id=pid,
            voice_id=data.selected_voice_id,
            avatar_id=data.selected_avatar_id,
            use_custom_voice=data.use_custom_voice,
            storyboard_scenes=data.storyboard_scenes,
            video_frame_size=data.video_frame_size,
            video_quality=data.video_quality,
            avatar_motion_enabled=data.avatar_motion_enabled,
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
    wid = _parse_uuid(workspace_id, "workspace_id")
    service = PipelineService(session)
    return await service.get_status(pid, wid)

@router.get("/videos/status", response_model=VideoResult)
async def check_video_status(
    workspace_id: str,
    project_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Poll HeyGen API for video progress."""
    pid = _parse_uuid(project_id, "project_id")
    wid = _parse_uuid(workspace_id, "workspace_id")
    service = PipelineService(session)
    result = await service.check_video_status(user_id=user_id, workspace_id=wid, project_id=pid)
    if not result:
        raise HTTPException(status_code=404, detail="No video generation found for this project.")
    return result

@router.get("/voices")
async def get_voices(
    workspace_id: str,
    project_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get list of available voices from ElevenLabs."""
    try:
        service = PipelineService(session)
        return await service.get_voices(user_id=user_id)
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/voices/clone")
async def clone_voice(
    workspace_id: str,
    project_id: str,
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Clone a voice using an uploaded audio sample."""
    try:
        file_bytes = await file.read()
        service = PipelineService(session)
        return await service.clone_voice(
            user_id=user_id,
            name=name,
            description=description,
            file_bytes=file_bytes,
            filename=file.filename or "sample.mp3"
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clone voice: {str(e)}")

@router.post("/merge")
async def merge_scene_videos(
    workspace_id: str,
    project_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Merge completed scene videos into a final video."""
    pid = _parse_uuid(project_id, "project_id")
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        result = await service.merge_scene_videos(user_id=user_id, workspace_id=wid, project_id=pid)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to merge videos: {str(e)}")

@router.get("/video")
async def get_final_video(
    workspace_id: str,
    project_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Stream the merged final video (.mp4) for playback or download."""
    pid = _parse_uuid(project_id, "project_id")
    wid = _parse_uuid(workspace_id, "workspace_id")
    service = PipelineService(session)
    path = await service.get_final_video_path(user_id=user_id, workspace_id=wid, project_id=pid)
    return FileResponse(path, media_type="video/mp4", filename=f"{project_id}_final.mp4")


@router.get("/package")
async def get_project_package(
    workspace_id: str,
    project_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Download the final zipped project package."""
    pid = _parse_uuid(project_id, "project_id")
    wid = _parse_uuid(workspace_id, "workspace_id")
    try:
        service = PipelineService(session)
        zip_path = await service.generate_project_package(user_id=user_id, workspace_id=wid, project_id=pid)
        return FileResponse(zip_path, media_type='application/zip', filename=f"{project_id}_package.zip")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate package: {str(e)}")
