"""Workspace API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.db.session import get_db
from app.schemas.auth import MessageResponse
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate
from app.schemas.dashboard import DashboardStatsResponse
from app.services.workspace import WorkspaceService
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Create a new workspace."""
    service = WorkspaceService(session)
    return await service.create_workspace(data, user_id)


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """List all workspaces the current user is a member of."""
    service = WorkspaceService(session)
    return await service.get_user_workspaces(user_id)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get workspace details. Requires membership."""
    service = WorkspaceService(session)
    return await service.get_workspace(workspace_id, user_id)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Update workspace settings. Requires admin or owner role."""
    service = WorkspaceService(session)
    return await service.update_workspace(workspace_id, data, user_id)


@router.delete("/{workspace_id}", response_model=MessageResponse)
async def delete_workspace(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Soft-delete a workspace. Requires owner role."""
    service = WorkspaceService(session)
    await service.delete_workspace(workspace_id, user_id)
    return MessageResponse(message="Workspace deleted")

@router.get("/{workspace_id}/dashboard-stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get aggregated dashboard metrics for a workspace. Requires membership."""
    # First verify membership
    ws_service = WorkspaceService(session)
    await ws_service.get_workspace(workspace_id, user_id)
    
    # Then get stats
    dash_service = DashboardService(session)
    return await dash_service.get_workspace_stats(workspace_id)
