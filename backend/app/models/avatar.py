import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel

class AvatarAsset(BaseModel):
    __tablename__ = "avatar_assets"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    heygen_avatar_id: Mapped[str] = mapped_column(String, nullable=True) # Look ID
    heygen_group_id: Mapped[str] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    avatar_type: Mapped[str] = mapped_column(String, nullable=False) # photo, prompt, digital_twin
    preview_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ready") # ready, pending_consent, failed
