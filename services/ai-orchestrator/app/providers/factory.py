"""Select AI provider from environment."""

from __future__ import annotations

import os

from .anthropic_adapter import AnthropicAdapter
from .base import ProviderAdapter, ProviderUnavailable
from .gemini_adapter import GeminiAdapter
from .mock import MockProvider
from .openai_adapter import OpenAIAdapter


def _has_any_key() -> bool:
    return bool(
        os.getenv("OPENAI_API_KEY")
        or os.getenv("ANTHROPIC_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )


def get_provider(name: str | None = None) -> ProviderAdapter:
    """Resolve provider.

    AI_PROVIDER=mock|openai|anthropic|gemini
    Default: mock when no keys are present; otherwise honor AI_PROVIDER or mock.
    """
    requested = (name or os.getenv("AI_PROVIDER") or "").strip().lower()

    if not requested:
        requested = "mock" if not _has_any_key() else (os.getenv("AI_PROVIDER") or "mock")
        requested = requested.strip().lower() or "mock"

    if requested in ("mock", "sandbox"):
        return MockProvider()

    try:
        if requested == "openai":
            return OpenAIAdapter()
        if requested == "anthropic":
            return AnthropicAdapter()
        if requested == "gemini":
            return GeminiAdapter()
    except ProviderUnavailable:
        # Fall back to sandbox mock — never pretend the mock is the real vendor
        return MockProvider()

    # Unknown name → sandbox
    return MockProvider()
