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
