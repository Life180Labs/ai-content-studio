"""
Base repository with common CRUD operations.
"""

from __future__ import annotations

import uuid
from typing import Any, Generic, TypeVar

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)


class BaseRepository(Generic[ModelType]):
    """Generic repository providing standard CRUD operations with soft-delete."""

    def __init__(self, model: type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    def _active_filter(self):
        """Filter out soft-deleted records."""
        return self.model.deleted_at.is_(None)

    async def get_by_id(self, id: uuid.UUID) -> ModelType | None:
        stmt = select(self.model).where(
            and_(self.model.id == id, self._active_filter())
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        *,
        page: int = 1,
        per_page: int = 20,
        filters: list[Any] | None = None,
        order_by: Any | None = None,
    ) -> tuple[list[ModelType], int]:
        """Get paginated results. Returns (items, total_count)."""
        stmt = select(self.model).where(self._active_filter())

        if filters:
            for f in filters:
                stmt = stmt.where(f)

        # Count query
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0

        # Apply ordering
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        else:
            stmt = stmt.order_by(self.model.created_at.desc())

        # Apply pagination
        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)

        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, **kwargs: Any) -> ModelType:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def update(self, instance: ModelType, **kwargs: Any) -> ModelType:
        for key, value in kwargs.items():
            if hasattr(instance, key):
                setattr(instance, key, value)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def soft_delete(self, instance: ModelType) -> None:
        instance.soft_delete()
        await self.session.flush()

    async def hard_delete(self, instance: ModelType) -> None:
        await self.session.delete(instance)
        await self.session.flush()
