import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AvatarAssetResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    heygen_avatar_id: str | None
    heygen_group_id: str | None
    name: str
    avatar_type: str
    preview_image_url: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
