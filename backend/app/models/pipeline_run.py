"""Pipeline Run model — tracks each AI generation within a project."""

from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PipelineRun(BaseModel):
    __tablename__ = "pipeline_runs"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    stage: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # "content" | "script" | "storyboard" | "voice" | "avatar" | "video"

    input_data: Mapped[dict | None] = mapped_column(JSONB, default=dict, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSONB, default=dict, nullable=True)
    selected_variation: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # AI provider tracking
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default="success", nullable=False
    )  # "success" | "error" | "pending"
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    project = relationship("Project", backref="pipeline_runs")

    def __repr__(self) -> str:
        return f"<PipelineRun project={self.project_id} stage={self.stage}>"
