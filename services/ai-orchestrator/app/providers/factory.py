"""Provider factory — env-driven selection with honest sandbox fallback.

AI_PROVIDER: mock | openai | anthropic | gemini (default: mock)
OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY: provider credentials.
Missing keys => the mock sandbox provider, clearly labeled in every response.
"""
from __future__ import annotations

import os

from .anthropic import AnthropicProvider
from .base import ContributionProvider
from .gemini import GeminiProvider
from .mock import MockProvider
from .openai import OpenAIProvider


def create_provider(env: dict | None = None) -> ContributionProvider:
    source = env if env is not None else os.environ
    choice = source.get("AI_PROVIDER", "mock").lower()
    if choice == "openai":
        key = source.get("OPENAI_API_KEY", "")
        if key:
            return OpenAIProvider(key, model=source.get("OPENAI_MODEL", "gpt-4o-mini"))
    elif choice == "anthropic":
        key = source.get("ANTHROPIC_API_KEY", "")
        if key:
            return AnthropicProvider(key, model=source.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"))
    elif choice == "gemini":
        key = source.get("GEMINI_API_KEY", "")
        if key:
            return GeminiProvider(key, model=source.get("GEMINI_MODEL", "gemini-2.0-flash"))
    return MockProvider()
