"""Project API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.db.session import get_db
from app.schemas.auth import MessageResponse
from app.schemas.common import PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project import ProjectService

router = APIRouter(prefix="/workspaces/{workspace_id}/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    workspace_id: uuid.UUID,
    data: ProjectCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Create a new project in the workspace."""
    service = ProjectService(session)
    return await service.create_project(workspace_id, data, user_id)


@router.get("", response_model=PaginatedResponse)
async def list_projects(
    workspace_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """List projects in a workspace with pagination and optional status filter."""
    service = ProjectService(session)
    return await service.list_projects(
        workspace_id, user_id, page=page, per_page=per_page, status=status
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get project details."""
    service = ProjectService(session)
    return await service.get_project(workspace_id, project_id, user_id)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    data: ProjectUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Update a project."""
    service = ProjectService(session)
    return await service.update_project(workspace_id, project_id, data, user_id)


@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Soft-delete a project. Requires admin or owner role."""
    service = ProjectService(session)
    await service.delete_project(workspace_id, project_id, user_id)
    return MessageResponse(message="Project deleted")
