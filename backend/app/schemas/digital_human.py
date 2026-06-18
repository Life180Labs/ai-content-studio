import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class VoiceCloneResponse(BaseModel):
    id: uuid.UUID
    name: str
    heygen_voice_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class AvatarCloneResponse(BaseModel):
    id: uuid.UUID
    name: str
    heygen_avatar_id: str
    heygen_group_id: Optional[str] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DigitalHumanCreate(BaseModel):
    name: str
    role: str
    voice_tone: str
    accent: str
    description: Optional[str] = None
    voice_clone_id: uuid.UUID
    avatar_clone_id: uuid.UUID
    preview_video_url: Optional[str] = None

class DigitalHumanResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    voice_tone: str
    accent: str
    description: Optional[str] = None
    voice_clone_id: uuid.UUID
    avatar_clone_id: uuid.UUID
    preview_video_url: Optional[str] = None
    created_at: datetime
    
    # Nested for convenience
    voice_clone: Optional[VoiceCloneResponse] = None
    avatar_clone: Optional[AvatarCloneResponse] = None
    
    class Config:
        from_attributes = True

class PreviewRequest(BaseModel):
    voice_clone_id: str
    avatar_clone_id: str
