"""
Models package — imports all models so Alembic can discover them.
"""

from app.models.ai_preference import AIPreference
from app.models.audit_log import AuditLog
from app.models.base import BaseModel
from app.models.pipeline_run import PipelineRun
from app.models.project import Project, ProjectStatus
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.models.brand_kit import BrandKit
from app.models.avatar import AvatarAsset
from app.models.digital_human import VoiceClone, AvatarClone, DigitalHuman

__all__ = [
    "BaseModel",
    "User",
    "Workspace",
    "WorkspaceMember",
    "WorkspaceRole",
    "Project",
    "ProjectStatus",
    "RefreshToken",
    "AuditLog",
    "AIPreference",
    "PipelineRun",
    "BrandKit",
    "AvatarAsset",
    "VoiceClone",
    "AvatarClone",
    "DigitalHuman",
]

