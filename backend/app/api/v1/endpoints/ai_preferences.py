"""AI Preferences API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.db.session import get_db
from app.schemas.ai_preference import (
    AIPreferenceCreate,
    AIPreferenceResponse,
    AIPreferenceUpdate,
    ProvidersListResponse,
)
from app.services.ai_preference import AIPreferenceService

router = APIRouter(prefix="/ai", tags=["AI Configuration"])


@router.get("/preferences", response_model=AIPreferenceResponse | None)
async def get_preferences(
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get the current user's AI routing preferences."""
    service = AIPreferenceService(session)
    return await service.get_preferences(user_id)


@router.put("/preferences", response_model=AIPreferenceResponse)
async def save_preferences(
    data: AIPreferenceCreate,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Create or fully replace AI preferences."""
    service = AIPreferenceService(session)
    return await service.save_preferences(user_id, data)


@router.patch("/preferences", response_model=AIPreferenceResponse)
async def update_preferences(
    data: AIPreferenceUpdate,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Partially update AI preferences."""
    service = AIPreferenceService(session)
    return await service.update_preferences(user_id, data)


@router.get("/providers", response_model=ProvidersListResponse)
async def list_providers(
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """List all available AI providers and their models (including user custom models)."""
    service = AIPreferenceService(session)
    pref = await service.repo.get_by_user_id(user_id)
    custom_models = pref.custom_models if pref else None
    return service.get_available_providers(custom_models)
