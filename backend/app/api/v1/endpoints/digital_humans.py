import uuid
from typing import Any, List
import structlog
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.models.digital_human import DigitalHuman, VoiceClone, AvatarClone
from app.models.workspace import WorkspaceMember
from app.schemas.digital_human import DigitalHumanCreate, DigitalHumanResponse, VoiceCloneResponse, AvatarCloneResponse, PreviewRequest
from app.gateway.providers.heygen import HeyGenProvider

from fastapi.responses import FileResponse
from pathlib import Path
import tempfile
import time

logger = structlog.get_logger("api.digital_humans")
router = APIRouter()

# Simple temp file storage for mobile handoff
MOBILE_SESSIONS_DIR = Path(tempfile.gettempdir()) / "ai-content-studio-mobile-sessions"
MOBILE_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

async def _get_workspace_keys(session: AsyncSession, user_id: uuid.UUID, workspace_id: str) -> dict:
    from app.services.pipeline import PipelineService
    service = PipelineService(session)
    gateway = await service._get_gateway(user_id)
    return gateway.provider_keys

@router.post("/voice-clone", response_model=VoiceCloneResponse)
async def create_voice_clone(
    workspace_id: str,
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Create a voice clone using ElevenLabs."""
    wid = uuid.UUID(workspace_id)
    keys = await _get_workspace_keys(session, user_id, workspace_id)
    hg_key = keys.get("heygen")
    
    if not hg_key:
        raise HTTPException(status_code=400, detail="HeyGen API key not configured.")
        
    try:
        file_bytes = await file.read()
        provider = HeyGenProvider(api_key=hg_key)
        
        result = await provider.clone_voice(name, description, file_bytes, file.filename)
        voice_id = result.get("voice_id")
        
        if not voice_id:
            raise HTTPException(status_code=500, detail="Failed to retrieve voice_id from HeyGen.")
            
        clone = VoiceClone(
            workspace_id=wid,
            name=name,
            heygen_voice_id=voice_id
        )
        session.add(clone)
        await session.commit()
        await session.refresh(clone)
        
        return clone
    except Exception as e:
        logger.error("voice_clone_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")

@router.post("/avatar-clone", response_model=AvatarCloneResponse)
async def create_avatar_clone(
    workspace_id: str,
    name: str = Form(...),
    training_video: UploadFile = File(...),
    consent_video: UploadFile = File(...),
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Create a Digital Twin avatar using HeyGen."""
    wid = uuid.UUID(workspace_id)
    keys = await _get_workspace_keys(session, user_id, workspace_id)
    hg_key = keys.get("heygen")
    
    if not hg_key:
        raise HTTPException(status_code=400, detail="HeyGen API key not configured.")
        
    try:
        provider = HeyGenProvider(api_key=hg_key)
        
        # 1. Upload training video
        tv_bytes = await training_video.read()
        tv_asset_id = await provider.upload_asset(tv_bytes, training_video.content_type or "video/mp4")
        
        # 2. Upload consent video
        cv_bytes = await consent_video.read()
        cv_asset_id = await provider.upload_asset(cv_bytes, consent_video.content_type or "video/mp4")
        
        # 3. Request Digital Twin creation
        payload = {
            "name": name,
            "avatar_type": "digital_twin",
            "asset_id": tv_asset_id,
            "consent_id": cv_asset_id
        }
        
        twin_data = await provider.create_custom_avatar(payload)
        avatar_id = twin_data.get("avatar_id")
        
        if not avatar_id:
            raise HTTPException(status_code=500, detail="Failed to retrieve avatar_id from HeyGen.")
            
        clone = AvatarClone(
            workspace_id=wid,
            name=name,
            heygen_avatar_id=avatar_id,
            status="pending"
        )
        session.add(clone)
        await session.commit()
        await session.refresh(clone)
        
        return clone
    except Exception as e:
        logger.error("avatar_clone_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Avatar cloning failed: {str(e)}")

@router.post("/preview")
async def generate_preview(
    workspace_id: str,
    payload: PreviewRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Trigger 8-second preview generation for the Digital Human."""
    keys = await _get_workspace_keys(session, user_id, workspace_id)
    hg_key = keys.get("heygen")
    
    if not hg_key:
        raise HTTPException(status_code=400, detail="HeyGen API key not configured.")
        
    try:
        # Get Voice and Avatar IDs
        voice_stmt = select(VoiceClone).where(VoiceClone.id == uuid.UUID(payload.voice_clone_id))
        avatar_stmt = select(AvatarClone).where(AvatarClone.id == uuid.UUID(payload.avatar_clone_id))
        
        v_result = await session.execute(voice_stmt)
        a_result = await session.execute(avatar_stmt)
        
        voice = v_result.scalar_one_or_none()
        avatar = a_result.scalar_one_or_none()
        
        if not voice or not avatar:
            raise HTTPException(status_code=404, detail="Voice or Avatar clone not found.")
            
        provider = HeyGenProvider(api_key=hg_key)
        
        script = "Hello, I am your new AI presenter. Welcome to the Digital Human Creation Studio!"
        
        result = await provider.create_avatar_video(
            script=script,
            avatar_id=avatar.heygen_avatar_id,
            voice_id=voice.heygen_voice_id,
            dimension={"width": 1920, "height": 1080},
            test_mode=True  # Generates watermark video quicker for preview
        )
        
        return {"video_id": result["video_id"], "status": "processing"}
    except Exception as e:
        logger.error("preview_generation_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")

@router.post("", response_model=DigitalHumanResponse)
async def create_digital_human(
    workspace_id: str,
    payload: DigitalHumanCreate,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Save the final Digital Human."""
    wid = uuid.UUID(workspace_id)
    
    dh = DigitalHuman(
        workspace_id=wid,
        name=payload.name,
        role=payload.role,
        voice_tone=payload.voice_tone,
        accent=payload.accent,
        description=payload.description,
        voice_clone_id=payload.voice_clone_id,
        avatar_clone_id=payload.avatar_clone_id,
        preview_video_url=payload.preview_video_url,
    )
    session.add(dh)
    await session.commit()
    await session.refresh(dh)
    
    # Load relationships for response
    stmt = select(DigitalHuman).where(DigitalHuman.id == dh.id)
    res = await session.execute(stmt)
    return res.scalar_one()

@router.get("", response_model=List[DigitalHumanResponse])
async def list_digital_humans(
    workspace_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """List all Digital Humans in the workspace."""
    wid = uuid.UUID(workspace_id)
    stmt = select(DigitalHuman).where(DigitalHuman.workspace_id == wid).order_by(DigitalHuman.created_at.desc())
    res = await session.execute(stmt)
    return res.scalars().all()

@router.post("/mobile-session/{session_id}")
async def upload_mobile_session(
    workspace_id: str,
    session_id: str,
    file: UploadFile = File(...),
):
    """Upload a recorded video from a mobile device using a session ID."""
    try:
        # Save file to temp dir
        file_path = MOBILE_SESSIONS_DIR / f"{session_id}.webm"
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        return {"status": "success", "session_id": session_id}
    except Exception as e:
        logger.error("mobile_session_upload_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mobile-session/{session_id}")
async def get_mobile_session(
    workspace_id: str,
    session_id: str,
):
    """Retrieve a recorded video for a given session ID (polling)."""
    file_path = MOBILE_SESSIONS_DIR / f"{session_id}.webm"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Session not found or recording not finished.")
        
    # We use FileResponse to return the video. 
    return FileResponse(path=file_path, media_type="video/webm", filename=f"{session_id}.webm")
