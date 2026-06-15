from typing import Any
import uuid

from sqlalchemy import JSON, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel

class BrandKit(BaseModel):
    __tablename__ = "brand_kits"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    colors: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    fonts: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    logos: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
