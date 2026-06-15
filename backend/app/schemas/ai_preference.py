"""AI Preference Pydantic schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProviderKeyInput(BaseModel):
    """Input for setting provider API keys. Keys are never returned in responses."""

    gemini: str | None = None
    openai: str | None = None
    anthropic: str | None = None
    heygen: str | None = None


class TaskOverride(BaseModel):
    """Per-task model override."""

    provider: str
    model: str


class AIPreferenceCreate(BaseModel):
    """Create / full-update AI preferences."""

    default_provider: str = Field("gemini", description="Default AI provider")
    default_model: str = Field("gemini-2.5-flash", description="Default model")
    fallback_enabled: bool = False
    fallback_action: str = Field("retry", pattern="^(retry|switch_model)$")
    fallback_provider: str | None = None
    fallback_model: str | None = None
    retry_count: int = Field(2, ge=0, le=10)
    provider_keys: ProviderKeyInput | None = None
    task_overrides: dict[str, TaskOverride] | None = None
    custom_models: dict[str, list[str]] | None = None


class AIPreferenceUpdate(BaseModel):
    """Partial update of AI preferences."""

    default_provider: str | None = None
    default_model: str | None = None
    fallback_enabled: bool | None = None
    fallback_action: str | None = Field(None, pattern="^(retry|switch_model)$")
    fallback_provider: str | None = None
    fallback_model: str | None = None
    retry_count: int | None = Field(None, ge=0, le=10)
    provider_keys: ProviderKeyInput | None = None
    task_overrides: dict[str, TaskOverride] | None = None
    custom_models: dict[str, list[str]] | None = None


class ProviderKeyStatus(BaseModel):
    """Shows which providers have keys configured (never the actual key)."""

    gemini: bool = False
    openai: bool = False
    anthropic: bool = False
    heygen: bool = False


class AIPreferenceResponse(BaseModel):
    """Response schema — keys are masked, showing only configured status."""

    id: str
    default_provider: str
    default_model: str
    fallback_enabled: bool
    fallback_action: str
    fallback_provider: str | None = None
    fallback_model: str | None = None
    retry_count: int
    provider_keys_status: ProviderKeyStatus
    task_overrides: dict[str, TaskOverride] | None = None
    custom_models: dict[str, list[str]] | None = None

    class Config:
        from_attributes = True


class AvailableProvider(BaseModel):
    """Info about an available AI provider."""

    name: str
    display_name: str
    models: list[str]
    supports_text_generation: bool = True


class ProvidersListResponse(BaseModel):
    """List of all available providers and their models."""

    providers: list[AvailableProvider]
