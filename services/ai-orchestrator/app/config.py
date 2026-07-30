from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


ProviderName = Literal["sandbox", "openai", "anthropic", "gemini"]


class Settings(BaseSettings):
    """Runtime configuration for provider selection and service metadata."""

    ai_provider: ProviderName = "sandbox"
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None
    service_name: str = "ai-orchestrator"
    version: str = "0.1.0"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
