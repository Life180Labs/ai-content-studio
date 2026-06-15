"""AI Preference repository."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_preference import AIPreference
from app.repositories.base import BaseRepository


class AIPreferenceRepository(BaseRepository[AIPreference]):
    """Data access for AI preferences."""

    def __init__(self, session: AsyncSession):
        super().__init__(AIPreference, session)

    async def get_by_user_id(self, user_id: uuid.UUID) -> AIPreference | None:
        """Get preferences for a specific user."""
        stmt = select(AIPreference).where(
            AIPreference.user_id == user_id,
            AIPreference.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(self, user_id: uuid.UUID, **kwargs) -> AIPreference:
        """Create or update preferences for a user."""
        existing = await self.get_by_user_id(user_id)
        if existing:
            return await self.update(existing, **kwargs)
        return await self.create(user_id=user_id, **kwargs)
