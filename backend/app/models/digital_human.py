import uuid
from sqlalchemy import String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class VoiceClone(BaseModel):
    __tablename__ = "voice_clones"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    heygen_voice_id: Mapped[str] = mapped_column(String, nullable=False)


class AvatarClone(BaseModel):
    __tablename__ = "avatar_clones"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    heygen_avatar_id: Mapped[str] = mapped_column(String, nullable=False)
    heygen_group_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, ready, failed


class DigitalHuman(BaseModel):
    __tablename__ = "digital_humans"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    voice_tone: Mapped[str] = mapped_column(String, nullable=False)
    accent: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    voice_clone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("voice_clones.id", ondelete="CASCADE"), nullable=False
    )
    avatar_clone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("avatar_clones.id", ondelete="CASCADE"), nullable=False
    )
    
    preview_video_url: Mapped[str | None] = mapped_column(String, nullable=True)
