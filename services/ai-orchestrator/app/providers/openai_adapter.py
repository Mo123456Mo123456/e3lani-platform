"""OpenAI provider adapter — requires OPENAI_API_KEY."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from .base import ProviderAdapter, ProviderUnavailable


class OpenAIAdapter(ProviderAdapter):
    name = "openai"
    sandbox = False

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ProviderUnavailable("OPENAI_API_KEY is not set")

    def analyze_element(self, prompt: str, *, language: str = "ar") -> dict[str, Any]:
        system = (
            "Return ONLY JSON with keys: category, name, traits (floats 0-1), "
            "possibleBiomes (string array), risks (string array), narrative (string). "
            f"Language for narrative: {language}."
        )
        return self._chat_json(system, prompt)

    def narrate(self, facts: list[str], *, language: str = "ar") -> str:
        system = (
            "Write a short narrative STRICTLY using only the provided facts. "
            "Do not invent events, numbers, or causes. "
            f"Language: {language}."
        )
        user = "Facts:\n- " + "\n- ".join(facts)
        data = self._chat_text(system, user)
        return data

    def _chat_json(self, system: str, user: str) -> dict[str, Any]:
        text = self._chat_text(system, user)
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ProviderUnavailable(f"OpenAI returned non-JSON: {exc}") from exc

    def _chat_text(self, system: str, user: str) -> str:
        payload = {
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
        }
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception as exc:  # network / auth
            raise ProviderUnavailable(f"OpenAI unavailable: {exc}") from exc
