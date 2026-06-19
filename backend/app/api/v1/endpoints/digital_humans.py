import uuid
from typing import List
import structlog
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.models.digital_human import DigitalHuman, VoiceClone, AvatarClone
from app.schemas.digital_human import (
    DigitalHumanCreate,
    DigitalHumanResponse,
    VoiceCloneResponse,
    AvatarCloneResponse,
    PreviewRequest,
    VideoStatusResponse,
)
from app.gateway.providers.heygen import HeyGenProvider

from fastapi.responses import FileResponse
from pathlib import Path
import tempfile

logger = structlog.get_logger("api.digital_humans")
router = APIRouter()

MOBILE_SESSIONS_DIR = Path(tempfile.gettempdir()) / "ai-content-studio-mobile-sessions"
MOBILE_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


async def _get_workspace_keys(session: AsyncSession, user_id: uuid.UUID, workspace_id: str) -> dict:
    from app.services.pipeline import PipelineService
    service = PipelineService(session)
    gateway = await service._get_gateway(user_id)
    return gateway.provider_keys


def _heygen_provider(keys: dict) -> HeyGenProvider:
    hg_key = keys.get("heygen")
    if not hg_key:
        raise HTTPException(status_code=400, detail="HeyGen API key not configured. Add it in Settings → AI Provider Keys.")
    return HeyGenProvider(api_key=hg_key)


# ---------------------------------------------------------------------------
# Voice clone endpoints
# ---------------------------------------------------------------------------

@router.post("/voice-clone", response_model=VoiceCloneResponse)
async def create_voice_clone(
    workspace_id: str,
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Create a voice clone using HeyGen."""
    wid = uuid.UUID(workspace_id)
    keys = await _get_workspace_keys(session, user_id, workspace_id)
    provider = _heygen_provider(keys)

    try:
        file_bytes = await file.read()
        result = await provider.clone_voice(name, description, file_bytes, file.filename or "sample.mp3")
        voice_id = result.get("voice_id")
        if not voice_id:
            raise HTTPException(status_code=500, detail="Failed to retrieve voice_id from HeyGen.")

        clone = VoiceClone(workspace_id=wid, name=name, heygen_voice_id=voice_id)
        session.add(clone)
        await session.commit()
        await session.refresh(clone)
        return clone
    except HTTPException:
        raise
    except Exception as e:
        logger.error("voice_clone_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")


@router.get("/voice-clones", response_model=List[VoiceCloneResponse])
async def list_voice_clones(
    workspace_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """List all voice clones in the workspace."""
    wid = uuid.UUID(workspace_id)
    stmt = select(VoiceClone).where(
        VoiceClone.workspace_id == wid,
        VoiceClone.deleted_at.is_(None),
    ).order_by(VoiceClone.created_at.desc())
    res = await session.execute(stmt)
    return res.scalars().all()


@router.post("/voice-clones/{clone_id}/regenerate", response_model=VoiceCloneResponse)
async def regenerate_voice_clone(
    workspace_id: str,
    clone_id: str,
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Re-upload a new audio sample to improve an existing voice clone."""
    clone = await session.get(VoiceClone, uuid.UUID(clone_id))
    if not clone or clone.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Voice clone not found.")

    keys = await _get_workspace_keys(session, user_id, workspace_id)
    provider = _heygen_provider(keys)

    try:
        file_bytes = await file.read()
        result = await provider.clone_voice(name, description, file_bytes, file.filename or "sample.mp3")
        voice_id = result.get("voice_id")
        if not voice_id:
            raise HTTPException(status_code=500, detail="Failed to retrieve voice_id from HeyGen.")

        clone.heygen_voice_id = voice_id
        clone.name = name
        await session.commit()
        await session.refresh(clone)
        return clone
    except HTTPException:
        raise
    except Exception as e:
        logger.error("voice_clone_regenerate_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Voice re-cloning failed: {str(e)}")


# ---------------------------------------------------------------------------
# Avatar clone endpoints
# ---------------------------------------------------------------------------

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
    provider = _heygen_provider(keys)

    try:
        tv_bytes = await training_video.read()
        tv_asset_id = await provider.upload_asset(tv_bytes, training_video.content_type or "video/mp4")

        cv_bytes = await consent_video.read()
        cv_asset_id = await provider.upload_asset(cv_bytes, consent_video.content_type or "video/mp4")

        twin_data = await provider.create_custom_avatar({
            "name": name,
            "avatar_type": "digital_twin",
            "asset_id": tv_asset_id,
            "consent_id": cv_asset_id,
        })
        avatar_id = twin_data.get("avatar_id")
        group_id = twin_data.get("group_id") or twin_data.get("avatar_group_id")

        if not avatar_id:
            raise HTTPException(status_code=500, detail="Failed to retrieve avatar_id from HeyGen.")

        clone = AvatarClone(
            workspace_id=wid,
            name=name,
            heygen_avatar_id=avatar_id,
            heygen_group_id=group_id,
            status="pending",
        )
        session.add(clone)
        await session.commit()
        await session.refresh(clone)
        return clone
    except HTTPException:
        raise
    except Exception as e:
        logger.error("avatar_clone_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Avatar cloning failed: {str(e)}")


@router.get("/avatar-clones", response_model=List[AvatarCloneResponse])
async def list_avatar_clones(
    workspace_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """List all avatar clones in the workspace."""
    wid = uuid.UUID(workspace_id)
    stmt = select(AvatarClone).where(
        AvatarClone.workspace_id == wid,
        AvatarClone.deleted_at.is_(None),
    ).order_by(AvatarClone.created_at.desc())
    res = await session.execute(stmt)
    return res.scalars().all()


@router.post("/avatar-clones/{clone_id}/regenerate", response_model=AvatarCloneResponse)
async def regenerate_avatar_clone(
    workspace_id: str,
    clone_id: str,
    name: str = Form(...),
    training_video: UploadFile = File(...),
    consent_video: UploadFile = File(...),
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Re-upload training/consent videos to improve an existing avatar clone."""
    clone = await session.get(AvatarClone, uuid.UUID(clone_id))
    if not clone or clone.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Avatar clone not found.")

    keys = await _get_workspace_keys(session, user_id, workspace_id)
    provider = _heygen_provider(keys)

    try:
        tv_bytes = await training_video.read()
        tv_asset_id = await provider.upload_asset(tv_bytes, training_video.content_type or "video/mp4")

        cv_bytes = await consent_video.read()
        cv_asset_id = await provider.upload_asset(cv_bytes, consent_video.content_type or "video/mp4")

        twin_data = await provider.create_custom_avatar({
            "name": name,
            "avatar_type": "digital_twin",
            "asset_id": tv_asset_id,
            "consent_id": cv_asset_id,
        })
        avatar_id = twin_data.get("avatar_id")
        group_id = twin_data.get("group_id") or twin_data.get("avatar_group_id")

        if not avatar_id:
            raise HTTPException(status_code=500, detail="Failed to retrieve avatar_id from HeyGen.")

        clone.heygen_avatar_id = avatar_id
        clone.heygen_group_id = group_id
        clone.name = name
        clone.status = "pending"
        await session.commit()
        await session.refresh(clone)
        return clone
    except HTTPException:
        raise
    except Exception as e:
        logger.error("avatar_clone_regenerate_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Avatar re-cloning failed: {str(e)}")


# ---------------------------------------------------------------------------
# Preview generation and status polling
# ---------------------------------------------------------------------------

@router.post("/preview")
async def generate_preview(
    workspace_id: str,
    payload: PreviewRequest,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Trigger 8-second preview generation for the Digital Human."""
    keys = await _get_workspace_keys(session, user_id, workspace_id)
    provider = _heygen_provider(keys)

    try:
        voice_stmt = select(VoiceClone).where(VoiceClone.id == uuid.UUID(payload.voice_clone_id))
        avatar_stmt = select(AvatarClone).where(AvatarClone.id == uuid.UUID(payload.avatar_clone_id))

        voice = (await session.execute(voice_stmt)).scalar_one_or_none()
        avatar = (await session.execute(avatar_stmt)).scalar_one_or_none()

        if not voice or not avatar:
            raise HTTPException(status_code=404, detail="Voice or Avatar clone not found.")

        # Mock IDs are generated when HeyGen Enterprise features (voice cloning, digital twin)
        # are not available on the account. Skip the preview call and return a skipped status
        # so the wizard can still proceed to the save step.
        is_mock_voice = voice.heygen_voice_id.startswith("mock_")
        is_mock_avatar = avatar.heygen_avatar_id.startswith("mock_")

        if is_mock_voice or is_mock_avatar:
            logger.warning(
                "preview_skipped_mock_ids",
                voice_id=voice.heygen_voice_id,
                avatar_id=avatar.heygen_avatar_id,
            )
            return {
                "video_id": None,
                "status": "skipped",
                "message": (
                    "Preview skipped: voice cloning and/or digital twin creation requires a HeyGen Enterprise plan. "
                    "You can still save this Digital Human and use a HeyGen public avatar in the pipeline instead."
                ),
            }

        result = await provider.create_avatar_video(
            script="Hello, I am your new AI presenter. Welcome to the Digital Human Creation Studio!",
            avatar_id=avatar.heygen_avatar_id,
            voice_id=voice.heygen_voice_id,
            dimension={"width": 1920, "height": 1080},
            test_mode=True,
        )
        return {"video_id": result["video_id"], "status": "processing"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("preview_generation_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")


@router.get("/preview/{video_id}/status", response_model=VideoStatusResponse)
async def get_preview_status(
    workspace_id: str,
    video_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Poll HeyGen for the status of a preview video. Returns URL when completed."""
    keys = await _get_workspace_keys(session, user_id, workspace_id)
    provider = _heygen_provider(keys)

    try:
        data = await provider.get_video_status(video_id)
        return VideoStatusResponse(
            video_id=video_id,
            status=data.get("status", "processing"),
            video_url=data.get("video_url"),
            gif_url=data.get("gif_url"),
            error=data.get("error"),
        )
    except Exception as e:
        logger.error("preview_status_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


# ---------------------------------------------------------------------------
# Mobile session handoff
# ---------------------------------------------------------------------------

@router.post("/mobile-session/{session_id}")
async def upload_mobile_session(
    workspace_id: str,
    session_id: str,
    file: UploadFile = File(...),
):
    """Upload a recorded video from a mobile device using a session ID."""
    try:
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
    return FileResponse(path=file_path, media_type="video/webm", filename=f"{session_id}.webm")


# ---------------------------------------------------------------------------
# Digital Human CRUD
# ---------------------------------------------------------------------------

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
    return dh


@router.get("", response_model=List[DigitalHumanResponse])
async def list_digital_humans(
    workspace_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """List all Digital Humans in the workspace."""
    wid = uuid.UUID(workspace_id)
    stmt = (
        select(DigitalHuman)
        .where(DigitalHuman.workspace_id == wid, DigitalHuman.deleted_at.is_(None))
        .order_by(DigitalHuman.created_at.desc())
    )
    res = await session.execute(stmt)
    return res.scalars().all()


@router.get("/{dh_id}", response_model=DigitalHumanResponse)
async def get_digital_human(
    workspace_id: str,
    dh_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get a single Digital Human with its clones."""
    dh = await session.get(DigitalHuman, uuid.UUID(dh_id))
    if not dh or dh.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Digital Human not found.")

    # Load voice and avatar clones for the nested fields
    voice = await session.get(VoiceClone, dh.voice_clone_id)
    avatar = await session.get(AvatarClone, dh.avatar_clone_id)

    response = DigitalHumanResponse.model_validate(dh)
    if voice:
        from app.schemas.digital_human import VoiceCloneResponse
        response.voice_clone = VoiceCloneResponse.model_validate(voice)
    if avatar:
        from app.schemas.digital_human import AvatarCloneResponse
        response.avatar_clone = AvatarCloneResponse.model_validate(avatar)

    return response


@router.delete("/{dh_id}", status_code=204)
async def delete_digital_human(
    workspace_id: str,
    dh_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Soft-delete a Digital Human."""
    dh = await session.get(DigitalHuman, uuid.UUID(dh_id))
    if not dh or dh.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Digital Human not found.")
    dh.soft_delete()
    await session.commit()
