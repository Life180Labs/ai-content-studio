import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.gateway.router import AIGateway
from app.gateway.base import AIProviderError
from app.models.brand_kit import BrandKit
from app.schemas.brand_kit import BrandKitCreate, BrandKitUpdate
from app.repositories.ai_preference import AIPreferenceRepository
from app.services.ai_preference import AIPreferenceService

class AssetService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _get_gateway(self, user_id: uuid.UUID) -> AIGateway:
        pref_repo = AIPreferenceRepository(self.session)
        pref_service = AIPreferenceService(pref_repo)
        preferences = await pref_service.get_preferences(user_id)
        gateway = AIGateway()
        if preferences:
            for k, v in preferences.provider_keys.items():
                gateway.add_provider_key(k, v)
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
