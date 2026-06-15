"""API v1 router — aggregates all endpoint routers."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints.ai_preferences import router as ai_preferences_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.pipeline import router as pipeline_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.workspaces import router as workspaces_router
from app.api.v1.endpoints.assets import router as assets_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(workspaces_router)
api_router.include_router(projects_router)
api_router.include_router(ai_preferences_router)
api_router.include_router(pipeline_router)
api_router.include_router(
    assets_router,
    prefix="/workspaces/{workspace_id}/assets",
    tags=["assets"],
)

