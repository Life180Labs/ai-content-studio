"""
AI Preference service — business logic for provider configuration.
"""

from __future__ import annotations

import json
import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_value, encrypt_value
from app.gateway.base import PROVIDER_MODELS
from app.repositories.ai_preference import AIPreferenceRepository
from app.schemas.ai_preference import (
    AIPreferenceCreate,
    AIPreferenceResponse,
    AIPreferenceUpdate,
    AvailableProvider,
    ProviderKeyStatus,
    ProvidersListResponse,
)

logger = structlog.get_logger("ai_preference")


class AIPreferenceService:
    """Manages AI provider preferences per user."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AIPreferenceRepository(session)

    async def get_preferences(self, user_id: uuid.UUID) -> AIPreferenceResponse | None:
        """Get the current user's AI preferences."""
        pref = await self.repo.get_by_user_id(user_id)
        if not pref:
            return None
        return self._to_response(pref)

    async def save_preferences(
        self, user_id: uuid.UUID, data: AIPreferenceCreate
    ) -> AIPreferenceResponse:
        """Create or fully update AI preferences."""
        update_data = {
            "default_provider": data.default_provider,
            "default_model": data.default_model,
            "fallback_enabled": data.fallback_enabled,
            "fallback_action": data.fallback_action,
            "fallback_provider": data.fallback_provider,
            "fallback_model": data.fallback_model,
            "retry_count": data.retry_count,
            "task_overrides": (
                {k: v.model_dump() for k, v in data.task_overrides.items()}
                if data.task_overrides
                else {}
            ),
            "custom_models": data.custom_models or {},
        }

        # Encrypt provider keys if provided
        if data.provider_keys:
            keys_dict = {
                k: v
                for k, v in data.provider_keys.model_dump().items()
                if v is not None and v.strip()
            }
            if keys_dict:
                # Merge with existing keys (don't overwrite keys not provided)
                existing = await self.repo.get_by_user_id(user_id)
                if existing and existing.provider_keys_encrypted:
                    try:
                        existing_keys = json.loads(
                            decrypt_value(existing.provider_keys_encrypted)
                        )
                        existing_keys.update(keys_dict)
                        keys_dict = existing_keys
                    except Exception:
                        pass  # If decryption fails, use only new keys

                update_data["provider_keys_encrypted"] = encrypt_value(
                    json.dumps(keys_dict)
                )

        pref = await self.repo.upsert(user_id, **update_data)
        logger.info("ai_preferences_saved", user_id=str(user_id))
        return self._to_response(pref)

    async def update_preferences(
        self, user_id: uuid.UUID, data: AIPreferenceUpdate
    ) -> AIPreferenceResponse:
        """Partially update AI preferences."""
        pref = await self.repo.get_by_user_id(user_id)
        if not pref:
            # Create with defaults + provided fields
            create_data = AIPreferenceCreate(**{
                k: v for k, v in data.model_dump().items() if v is not None
            })
            return await self.save_preferences(user_id, create_data)

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}

        # Handle provider keys separately
        if "provider_keys" in update_data:
            keys_input = update_data.pop("provider_keys")
            if keys_input:
                keys_dict = {k: v for k, v in keys_input.items() if v is not None and v.strip()}
                if keys_dict:
                    # Merge with existing
                    if pref.provider_keys_encrypted:
                        try:
                            existing_keys = json.loads(
                                decrypt_value(pref.provider_keys_encrypted)
                            )
                            existing_keys.update(keys_dict)
                            keys_dict = existing_keys
                        except Exception:
                            pass

                    update_data["provider_keys_encrypted"] = encrypt_value(
                        json.dumps(keys_dict)
                    )

        # Handle task overrides
        if "task_overrides" in update_data and update_data["task_overrides"]:
            update_data["task_overrides"] = {
                k: v if isinstance(v, dict) else v.model_dump()
                for k, v in update_data["task_overrides"].items()
            }

        pref = await self.repo.update(pref, **update_data)
        logger.info("ai_preferences_updated", user_id=str(user_id))
        return self._to_response(pref)

    def get_decrypted_keys(self, pref) -> dict[str, str]:
        """Decrypt and return the raw provider keys (internal use only)."""
        if not pref or not pref.provider_keys_encrypted:
            return {}
        try:
            return json.loads(decrypt_value(pref.provider_keys_encrypted))
        except Exception:
            logger.warning("failed_to_decrypt_provider_keys", user_id=str(pref.user_id))
            return {}

    @staticmethod
    def get_available_providers(custom_models: dict | None = None) -> ProvidersListResponse:
        """Return all available providers with their models."""
        providers = []
        display_names = {
            "gemini": "Google Gemini",
            "openai": "OpenAI",
            "anthropic": "Anthropic",
            "heygen": "HeyGen",
        }

        for name, models in PROVIDER_MODELS.items():
            # Merge custom models if provided
            all_models = list(models)
            if custom_models and name in custom_models:
                for m in custom_models[name]:
                    if m not in all_models:
                        all_models.append(m)

            providers.append(
                AvailableProvider(
                    name=name,
                    display_name=display_names.get(name, name.title()),
                    models=all_models,
                    supports_text_generation=name != "heygen",
                )
            )

        return ProvidersListResponse(providers=providers)

    def _to_response(self, pref) -> AIPreferenceResponse:
        """Convert model to response with masked keys."""
        key_status = ProviderKeyStatus()
        if pref.provider_keys_encrypted:
            try:
                keys = json.loads(decrypt_value(pref.provider_keys_encrypted))
                key_status = ProviderKeyStatus(
                    gemini=bool(keys.get("gemini")),
                    openai=bool(keys.get("openai")),
                    anthropic=bool(keys.get("anthropic")),
                    heygen=bool(keys.get("heygen")),
                )
            except Exception:
                pass

        return AIPreferenceResponse(
            id=str(pref.id),
            default_provider=pref.default_provider,
            default_model=pref.default_model,
            fallback_enabled=pref.fallback_enabled,
            fallback_action=pref.fallback_action,
            fallback_provider=pref.fallback_provider,
            fallback_model=pref.fallback_model,
            retry_count=pref.retry_count,
            provider_keys_status=key_status,
            task_overrides=pref.task_overrides,
            custom_models=pref.custom_models,
        )
