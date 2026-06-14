"""Project Pydantic schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = None
    canvas_data: dict | None = None
    current_stage: int | None = None


class ProjectResponse(BaseModel):
    id: str
    workspace_id: str
    created_by: str
    name: str
    description: str | None = None
    status: str
    langgraph_thread_id: str | None = None
    canvas_data: dict | None = None
    current_stage: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
