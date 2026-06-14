"""Workspace service — business logic for workspace operations."""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.workspace import WorkspaceRole
from app.repositories.workspace import WorkspaceMemberRepository, WorkspaceRepository
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate

logger = structlog.get_logger("workspace")


class WorkspaceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.workspace_repo = WorkspaceRepository(session)
        self.member_repo = WorkspaceMemberRepository(session)

    async def create_workspace(
        self, data: WorkspaceCreate, owner_id: uuid.UUID
    ) -> WorkspaceResponse:
        # Check slug uniqueness
        existing = await self.workspace_repo.get_by_slug(data.slug)
        if existing:
            raise ConflictError("A workspace with this slug already exists")

        workspace = await self.workspace_repo.create(
            name=data.name,
            slug=data.slug,
            owner_id=owner_id,
        )

        # Add owner as a member
        await self.member_repo.create(
            workspace_id=workspace.id,
            user_id=owner_id,
            role=WorkspaceRole.OWNER,
        )

        logger.info("workspace_created", workspace_id=str(workspace.id), slug=data.slug)

        return WorkspaceResponse(
            id=str(workspace.id),
            name=workspace.name,
            slug=workspace.slug,
            owner_id=str(workspace.owner_id),
            settings=workspace.settings,
            created_at=workspace.created_at,
            updated_at=workspace.updated_at,
        )

    async def get_user_workspaces(self, user_id: uuid.UUID) -> list[WorkspaceResponse]:
        workspaces = await self.workspace_repo.get_user_workspaces(user_id)
        return [
            WorkspaceResponse(
                id=str(w.id),
                name=w.name,
                slug=w.slug,
                owner_id=str(w.owner_id),
                settings=w.settings,
                created_at=w.created_at,
                updated_at=w.updated_at,
            )
            for w in workspaces
        ]

    async def get_workspace(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkspaceResponse:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        if not workspace:
            raise NotFoundError("Workspace not found")

        # Verify membership
        member = await self.member_repo.get_membership(workspace_id, user_id)
        if not member:
            raise ForbiddenError("You are not a member of this workspace")

        return WorkspaceResponse(
            id=str(workspace.id),
            name=workspace.name,
            slug=workspace.slug,
            owner_id=str(workspace.owner_id),
            settings=workspace.settings,
            created_at=workspace.created_at,
            updated_at=workspace.updated_at,
        )

    async def update_workspace(
        self, workspace_id: uuid.UUID, data: WorkspaceUpdate, user_id: uuid.UUID
    ) -> WorkspaceResponse:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        if not workspace:
            raise NotFoundError("Workspace not found")

        member = await self.member_repo.get_membership(workspace_id, user_id)
        if not member or member.role not in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN):
            raise ForbiddenError("Only owners and admins can update workspace settings")

        update_data = data.model_dump(exclude_unset=True)
        workspace = await self.workspace_repo.update(workspace, **update_data)

        return WorkspaceResponse(
            id=str(workspace.id),
            name=workspace.name,
            slug=workspace.slug,
            owner_id=str(workspace.owner_id),
            settings=workspace.settings,
            created_at=workspace.created_at,
            updated_at=workspace.updated_at,
        )

    async def delete_workspace(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        if not workspace:
            raise NotFoundError("Workspace not found")

        if workspace.owner_id != user_id:
            raise ForbiddenError("Only the workspace owner can delete it")

        await self.workspace_repo.soft_delete(workspace)
        logger.info("workspace_deleted", workspace_id=str(workspace_id))
