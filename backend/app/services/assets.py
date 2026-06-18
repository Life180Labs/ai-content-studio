import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.gateway.router import AIGateway
from app.gateway.base import AIProviderError
from app.models.brand_kit import BrandKit
from app.schemas.brand_kit import BrandKitCreate, BrandKitUpdate
from app.repositories.ai_preference import AIPreferenceRepository
from app.services.ai_preference import AIPreferenceService
from app.models.avatar import AvatarAsset
from app.schemas.assets import AvatarAssetResponse

class AssetService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _get_gateway(self, user_id: uuid.UUID) -> AIGateway:
        pref_service = AIPreferenceService(self.session)
        pref_model = await pref_service.repo.get_by_user_id(user_id)
        keys = {}
        if pref_model:
            keys = pref_service.get_decrypted_keys(pref_model)
        
        gateway = AIGateway(provider_keys=keys)
        return gateway

    async def get_voices(self, user_id: uuid.UUID) -> list[dict]:
        gateway = await self._get_gateway(user_id)
        el_key = gateway.provider_keys.get("elevenlabs")
        if not el_key:
            raise AIProviderError("ElevenLabs API key not configured.", provider="elevenlabs", model="")
        from app.gateway.providers.elevenlabs import ElevenLabsProvider
        provider = ElevenLabsProvider(api_key=el_key)
        return await provider.get_voices()

    async def clone_voice(self, user_id: uuid.UUID, name: str, description: str, file_bytes: bytes, filename: str) -> dict:
        gateway = await self._get_gateway(user_id)
        el_key = gateway.provider_keys.get("elevenlabs")
        if not el_key:
            raise AIProviderError("ElevenLabs API key not configured.", provider="elevenlabs", model="")
        from app.gateway.providers.elevenlabs import ElevenLabsProvider
        provider = ElevenLabsProvider(api_key=el_key)
        return await provider.clone_voice(name, description, file_bytes, filename)

    async def get_avatars(self, user_id: uuid.UUID) -> list[dict]:
        gateway = await self._get_gateway(user_id)
        heygen_key = gateway.provider_keys.get("heygen")
        if not heygen_key:
            raise AIProviderError("HeyGen API key not configured.", provider="heygen", model="")
        from app.gateway.providers.heygen import HeyGenProvider
        provider = HeyGenProvider(api_key=heygen_key)
        return await provider.get_avatars()

    async def create_custom_avatar(
        self,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        name: str,
        avatar_type: str,
        prompt: str | None = None,
        file_bytes: bytes | None = None,
        content_type: str = "image/png"
    ) -> dict:
        gateway = await self._get_gateway(user_id)
        heygen_key = gateway.provider_keys.get("heygen")
        if not heygen_key:
            raise AIProviderError("HeyGen API key not configured.", provider="heygen", model="")
        
        from app.gateway.providers.heygen import HeyGenProvider
        provider = HeyGenProvider(api_key=heygen_key)
        
        if avatar_type == "photo":
            if not file_bytes:
                raise ValueError("Photo avatar requires an image file.")
            asset_id = await provider.upload_asset(file_bytes, content_type)
            payload = {"type": "photo", "name": name, "file": {"type": "asset_id", "asset_id": asset_id}}
            resp = await provider.create_custom_avatar(payload)
            item = resp.get("avatar_item", {})
            group = resp.get("avatar_group", {})
            
            avatar = AvatarAsset(
                workspace_id=workspace_id,
                name=name,
                avatar_type="photo",
                heygen_avatar_id=item.get("id"),
                heygen_group_id=group.get("id"),
                preview_image_url=item.get("preview_image_url"),
                status="ready"
            )
            self.session.add(avatar)
            await self.session.commit()
            await self.session.refresh(avatar)
            return {"avatar": AvatarAssetResponse.model_validate(avatar).model_dump()}
            
        elif avatar_type == "digital_twin":
            if not file_bytes:
                raise ValueError("Digital Twin requires a video file.")
            asset_id = await provider.upload_asset(file_bytes, content_type)
            payload = {"type": "digital_twin", "name": name, "file": {"type": "asset_id", "asset_id": asset_id}}
            resp = await provider.create_custom_avatar(payload)
            group = resp.get("avatar_group", {})
            group_id = group.get("id")
            
            avatar = AvatarAsset(
                workspace_id=workspace_id,
                name=name,
                avatar_type="digital_twin",
                heygen_group_id=group_id,
                status="pending_consent"
            )
            self.session.add(avatar)
            await self.session.commit()
            await self.session.refresh(avatar)
            
            consent_url = await provider.generate_consent_url(group_id, "https://ai-content-studio.local/consent-done")
            return {
                "avatar": AvatarAssetResponse.model_validate(avatar).model_dump(),
                "consent_url": consent_url
            }
            
        elif avatar_type == "prompt":
            if not prompt:
                raise ValueError("Prompt-to-Avatar requires a text prompt.")
            payload = {"type": "prompt", "name": name, "prompt": prompt}
            resp = await provider.create_custom_avatar(payload)
            item = resp.get("avatar_item", {})
            group = resp.get("avatar_group", {})
            
            avatar = AvatarAsset(
                workspace_id=workspace_id,
                name=name,
                avatar_type="prompt",
                heygen_avatar_id=item.get("id"),
                heygen_group_id=group.get("id"),
                preview_image_url=item.get("preview_image_url"),
                status="ready"
            )
            self.session.add(avatar)
            await self.session.commit()
            await self.session.refresh(avatar)
            return {"avatar": AvatarAssetResponse.model_validate(avatar).model_dump()}
            
        raise ValueError("Invalid avatar type.")

    async def get_custom_avatars(self, workspace_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            select(AvatarAsset).where(
                AvatarAsset.workspace_id == workspace_id,
                AvatarAsset.deleted_at.is_(None)
            ).order_by(AvatarAsset.created_at.desc())
        )
        avatars = result.scalars().all()
        return [AvatarAssetResponse.model_validate(a).model_dump() for a in avatars]

    # --- Brand Kits ---
    async def get_brand_kits(self, workspace_id: uuid.UUID) -> list[BrandKit]:
        result = await self.session.execute(
            select(BrandKit).where(BrandKit.workspace_id == workspace_id)
        )
        return list(result.scalars().all())

    async def create_brand_kit(self, workspace_id: uuid.UUID, data: BrandKitCreate) -> BrandKit:
        bk = BrandKit(
            workspace_id=workspace_id,
            name=data.name,
            colors=data.colors,
            fonts=data.fonts,
            logos=data.logos
        )
        self.session.add(bk)
        await self.session.commit()
        await self.session.refresh(bk)
        return bk

    async def update_brand_kit(self, kit_id: uuid.UUID, data: BrandKitUpdate) -> BrandKit | None:
        result = await self.session.execute(select(BrandKit).where(BrandKit.id == kit_id))
        bk = result.scalar_one_or_none()
        if not bk:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(bk, key, value)
            
        await self.session.commit()
        await self.session.refresh(bk)
        return bk

    async def delete_brand_kit(self, kit_id: uuid.UUID) -> bool:
        result = await self.session.execute(select(BrandKit).where(BrandKit.id == kit_id))
        bk = result.scalar_one_or_none()
        if not bk:
            return False
        
        await self.session.delete(bk)
        await self.session.commit()
        return True
