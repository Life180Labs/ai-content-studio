"""AI Preference model — per-user AI routing configuration."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class AIPreference(BaseModel):
    __tablename__ = "ai_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False, index=True
    )

    # Default routing
    default_provider: Mapped[str] = mapped_column(String(50), default="gemini", nullable=False)
    default_model: Mapped[str] = mapped_column(
        String(100), default="gemini-2.5-flash", nullable=False
    )

    # Fallback configuration
    fallback_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fallback_action: Mapped[str] = mapped_column(
        String(20), default="retry", nullable=False
    )  # "retry" | "switch_model"
    fallback_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fallback_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    # Encrypted JSON blob of provider API keys: {"gemini": "...", "openai": "..."}
    provider_keys_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Per-task model overrides: {"content": {"provider": "openai", "model": "gpt-4o"}, ...}
    task_overrides: Mapped[dict | None] = mapped_column(JSONB, default=dict, nullable=True)

    # User-added custom models: {"gemini": ["custom-model-1"], "openai": ["ft:gpt-4o:..."]}
    custom_models: Mapped[dict | None] = mapped_column(JSONB, default=dict, nullable=True)

    # Relationships
    user = relationship("User", backref="ai_preference", uselist=False)

    def __repr__(self) -> str:
        return f"<AIPreference user={self.user_id} provider={self.default_provider}>"
