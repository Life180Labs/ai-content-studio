"""Workspace repository."""

from __future__ import annotations

import uuid

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    def __init__(self, session: AsyncSession):
        super().__init__(Workspace, session)

    async def get_by_slug(self, slug: str) -> Workspace | None:
        stmt = select(Workspace).where(
            and_(Workspace.slug == slug, self._active_filter())
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_workspaces(self, user_id: uuid.UUID) -> list[Workspace]:
        """Get all workspaces a user is a member of."""
        stmt = (
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(
                and_(
                    WorkspaceMember.user_id == user_id,
                    Workspace.deleted_at.is_(None),
                )
            )
            .order_by(Workspace.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class WorkspaceMemberRepository(BaseRepository[WorkspaceMember]):
    def __init__(self, session: AsyncSession):
        super().__init__(WorkspaceMember, session)

    async def get_membership(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkspaceMember | None:
        stmt = select(WorkspaceMember).where(
            and_(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
