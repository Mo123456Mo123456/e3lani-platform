from app.config import Settings
from app.providers.anthropic_adapter import AnthropicAdapter
from app.providers.base import ElementProvider
from app.providers.gemini_adapter import GeminiAdapter
from app.providers.openai_adapter import OpenAIAdapter
from app.providers.sandbox import SandboxProvider


def get_provider(settings: Settings) -> ElementProvider:
    """Select a provider, falling back to sandbox whenever credentials are absent."""

    if settings.ai_provider == "openai" and settings.openai_api_key:
        return OpenAIAdapter()
    if settings.ai_provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicAdapter()
    if settings.ai_provider == "gemini" and settings.gemini_api_key:
        return GeminiAdapter()
    return SandboxProvider()
