"""Provider registry with sandbox fallback.

Selection order: explicit request -> AI_PROVIDER_DEFAULT -> first
configured real provider -> mock (sandbox). Every response declares
``provider`` and ``sandbox`` so the UI can badge non-production AI.
"""
from __future__ import annotations

import os

from .base import Provider
from .anthropic import AnthropicProvider
from .gemini import GeminiProvider
from .mock import MockProvider
from .openai import OpenAIProvider

_PROVIDERS: dict[str, Provider] = {
    "mock": MockProvider(),
    "openai": OpenAIProvider(),
    "anthropic": AnthropicProvider(),
    "gemini": GeminiProvider(),
}


def get_provider(name: str | None = None) -> Provider:
    requested = (name or os.getenv("AI_PROVIDER_DEFAULT") or "mock").lower()
    provider = _PROVIDERS.get(requested)
    if provider and provider.configured():
        return provider
    for candidate in ("openai", "anthropic", "gemini"):
        p = _PROVIDERS[candidate]
        if p.configured():
            return p
    return _PROVIDERS["mock"]


def provider_status() -> list[dict[str, object]]:
    return [
        {
            "name": p.name,
            "configured": p.configured(),
            "sandbox": not p.configured() or p.name == "mock",
        }
        for p in _PROVIDERS.values()
    ]
