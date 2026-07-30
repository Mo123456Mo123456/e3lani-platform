"""Anthropic provider adapter — requires ANTHROPIC_API_KEY."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from .base import ProviderAdapter, ProviderUnavailable


class AnthropicAdapter(ProviderAdapter):
    name = "anthropic"
    sandbox = False

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ProviderUnavailable("ANTHROPIC_API_KEY is not set")

    def analyze_element(self, prompt: str, *, language: str = "ar") -> dict[str, Any]:
        system = (
            "Return ONLY JSON with keys: category, name, traits (floats 0-1), "
            "possibleBiomes, risks, narrative. "
            f"Language for narrative: {language}."
        )
        return self._json(system, prompt)

    def narrate(self, facts: list[str], *, language: str = "ar") -> str:
        system = (
            "Write a short narrative STRICTLY using only the provided facts. "
            "Do not invent events. "
            f"Language: {language}."
        )
        return self._text(system, "Facts:\n- " + "\n- ".join(facts))

    def _json(self, system: str, user: str) -> dict[str, Any]:
        text = self._text(system, user)
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ProviderUnavailable(f"Anthropic returned non-JSON: {exc}") from exc

    def _text(self, system: str, user: str) -> str:
        payload = {
            "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
            "max_tokens": 1024,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                parts = data.get("content") or []
                return "".join(p.get("text", "") for p in parts if p.get("type") == "text")
        except Exception as exc:
            raise ProviderUnavailable(f"Anthropic unavailable: {exc}") from exc
