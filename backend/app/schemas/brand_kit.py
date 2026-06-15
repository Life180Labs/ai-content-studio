from typing import Any
from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime

class BrandKitBase(BaseModel):
    name: str
    colors: dict[str, Any] = {}
    fonts: dict[str, Any] = {}
    logos: dict[str, Any] = {}

class BrandKitCreate(BrandKitBase):
    pass

class BrandKitUpdate(BaseModel):
    name: str | None = None
    colors: dict[str, Any] | None = None
    fonts: dict[str, Any] | None = None
    logos: dict[str, Any] | None = None

class BrandKitResponse(BrandKitBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
