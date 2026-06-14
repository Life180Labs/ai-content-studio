"""Project repository."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self, session: AsyncSession):
        super().__init__(Project, session)

    async def get_workspace_projects(
        self,
        workspace_id: uuid.UUID,
        *,
        page: int = 1,
        per_page: int = 20,
        status: str | None = None,
    ) -> tuple[list[Project], int]:
        filters: list[Any] = [Project.workspace_id == workspace_id]
        if status:
            filters.append(Project.status == status)
        return await self.get_all(page=page, per_page=per_page, filters=filters)
