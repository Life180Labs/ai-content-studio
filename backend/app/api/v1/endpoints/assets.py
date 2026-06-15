import uuid
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.db.session import get_db
from app.gateway.base import AIProviderError
from app.schemas.brand_kit import BrandKitCreate, BrandKitUpdate, BrandKitResponse
from app.services.assets import AssetService

router = APIRouter()

def _parse_uuid(id_str: str, name: str) -> uuid.UUID:
    try:
        return uuid.UUID(id_str)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid UUID for {name}")

# --- AI Assets (Voices and Avatars) ---

@router.get("/voices")
async def get_workspace_voices(
    workspace_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    try:
        service = AssetService(session)
        return await service.get_voices(user_id=user_id)
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/voices/clone")
async def clone_workspace_voice(
    workspace_id: str,
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    try:
        file_bytes = await file.read()
        service = AssetService(session)
        return await service.clone_voice(
            user_id=user_id,
            name=name,
            description=description,
            file_bytes=file_bytes,
            filename=file.filename or "sample.mp3"
        )
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clone voice: {str(e)}")

@router.get("/avatars")
async def get_workspace_avatars(
    workspace_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    try:
        service = AssetService(session)
        return await service.get_avatars(user_id=user_id)
    except AIProviderError as e:
        raise HTTPException(status_code=422, detail=str(e))

# --- Brand Kits ---

@router.get("/brand-kits", response_model=list[BrandKitResponse])
async def list_brand_kits(
    workspace_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    wid = _parse_uuid(workspace_id, "workspace_id")
    service = AssetService(session)
    return await service.get_brand_kits(workspace_id=wid)

@router.post("/brand-kits", response_model=BrandKitResponse)
async def create_brand_kit(
    workspace_id: str,
    data: BrandKitCreate,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    wid = _parse_uuid(workspace_id, "workspace_id")
    service = AssetService(session)
    return await service.create_brand_kit(workspace_id=wid, data=data)

@router.put("/brand-kits/{kit_id}", response_model=BrandKitResponse)
async def update_brand_kit(
    workspace_id: str,
    kit_id: str,
    data: BrandKitUpdate,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    kid = _parse_uuid(kit_id, "kit_id")
    service = AssetService(session)
    bk = await service.update_brand_kit(kit_id=kid, data=data)
    if not bk:
        raise HTTPException(status_code=404, detail="Brand kit not found")
    return bk

@router.delete("/brand-kits/{kit_id}", status_code=204)
async def delete_brand_kit(
    workspace_id: str,
    kit_id: str,
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    kid = _parse_uuid(kit_id, "kit_id")
    service = AssetService(session)
    success = await service.delete_brand_kit(kit_id=kid)
    if not success:
        raise HTTPException(status_code=404, detail="Brand kit not found")
    return None
