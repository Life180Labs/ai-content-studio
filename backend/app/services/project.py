"""Project service — business logic for project operations."""

from __future__ import annotations

import math
import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.workspace import WorkspaceRole
from app.repositories.project import ProjectRepository
from app.repositories.workspace import WorkspaceMemberRepository, WorkspaceRepository
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

logger = structlog.get_logger("project")


class ProjectService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.project_repo = ProjectRepository(session)
        self.workspace_repo = WorkspaceRepository(session)
        self.member_repo = WorkspaceMemberRepository(session)

    async def _verify_membership(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        if not workspace:
            raise NotFoundError("Workspace not found")

        member = await self.member_repo.get_membership(workspace_id, user_id)
        if not member:
            raise ForbiddenError("You are not a member of this workspace")

    async def _verify_admin(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        member = await self.member_repo.get_membership(workspace_id, user_id)
        if not member or member.role not in (
            WorkspaceRole.OWNER,
            WorkspaceRole.ADMIN,
        ):
            raise ForbiddenError("Insufficient permissions")

    async def create_project(
        self,
        workspace_id: uuid.UUID,
        data: ProjectCreate,
        user_id: uuid.UUID,
    ) -> ProjectResponse:
        await self._verify_membership(workspace_id, user_id)

        project = await self.project_repo.create(
            workspace_id=workspace_id,
            created_by=user_id,
            name=data.name,
            description=data.description,
        )

        logger.info("project_created", project_id=str(project.id))

        return ProjectResponse(
            id=str(project.id),
            workspace_id=str(project.workspace_id),
            created_by=str(project.created_by),
            name=project.name,
            description=project.description,
            status=project.status.value,
            langgraph_thread_id=project.langgraph_thread_id,
            canvas_data=project.canvas_data,
            current_stage=project.current_stage,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def list_projects(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        page: int = 1,
        per_page: int = 20,
        status: str | None = None,
    ) -> PaginatedResponse:
        await self._verify_membership(workspace_id, user_id)

        projects, total = await self.project_repo.get_workspace_projects(
            workspace_id, page=page, per_page=per_page, status=status
        )

        return PaginatedResponse(
            data=[
                ProjectResponse(
                    id=str(p.id),
                    workspace_id=str(p.workspace_id),
                    created_by=str(p.created_by),
                    name=p.name,
                    description=p.description,
                    status=p.status.value,
                    langgraph_thread_id=p.langgraph_thread_id,
                    canvas_data=p.canvas_data,
                    current_stage=p.current_stage,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
                for p in projects
            ],
            pagination=PaginationMeta(
                page=page,
                per_page=per_page,
                total=total,
                total_pages=math.ceil(total / per_page) if total > 0 else 0,
            ),
        )

    async def get_project(
        self, workspace_id: uuid.UUID, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> ProjectResponse:
        await self._verify_membership(workspace_id, user_id)

        project = await self.project_repo.get_by_id(project_id)
        if not project or str(project.workspace_id) != str(workspace_id):
            raise NotFoundError("Project not found")

        return ProjectResponse(
            id=str(project.id),
            workspace_id=str(project.workspace_id),
            created_by=str(project.created_by),
            name=project.name,
            description=project.description,
            status=project.status.value,
            langgraph_thread_id=project.langgraph_thread_id,
            canvas_data=project.canvas_data,
            current_stage=project.current_stage,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def update_project(
        self,
        workspace_id: uuid.UUID,
        project_id: uuid.UUID,
        data: ProjectUpdate,
        user_id: uuid.UUID,
    ) -> ProjectResponse:
        await self._verify_membership(workspace_id, user_id)

        project = await self.project_repo.get_by_id(project_id)
        if not project or str(project.workspace_id) != str(workspace_id):
            raise NotFoundError("Project not found")

        update_data = data.model_dump(exclude_unset=True)
        project = await self.project_repo.update(project, **update_data)

        return ProjectResponse(
            id=str(project.id),
            workspace_id=str(project.workspace_id),
            created_by=str(project.created_by),
            name=project.name,
            description=project.description,
            status=project.status.value,
            langgraph_thread_id=project.langgraph_thread_id,
            canvas_data=project.canvas_data,
            current_stage=project.current_stage,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def delete_project(
        self, workspace_id: uuid.UUID, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        await self._verify_admin(workspace_id, user_id)

        project = await self.project_repo.get_by_id(project_id)
        if not project or str(project.workspace_id) != str(workspace_id):
            raise NotFoundError("Project not found")

        await self.project_repo.soft_delete(project)
        logger.info("project_deleted", project_id=str(project_id))
