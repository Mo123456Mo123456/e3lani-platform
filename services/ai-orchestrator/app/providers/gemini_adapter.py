"""Gemini provider adapter — requires GEMINI_API_KEY or GOOGLE_API_KEY."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from .base import ProviderAdapter, ProviderUnavailable


class GeminiAdapter(ProviderAdapter):
    name = "gemini"
    sandbox = False

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ProviderUnavailable("GEMINI_API_KEY / GOOGLE_API_KEY is not set")

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
        return self._text(system + "\n\nFacts:\n- " + "\n- ".join(facts))

    def _json(self, system: str, user: str) -> dict[str, Any]:
        text = self._text(f"{system}\n\nUser:\n{user}")
        # Strip markdown fences if present
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ProviderUnavailable(f"Gemini returned non-JSON: {exc}") from exc

    def _text(self, prompt: str) -> str:
        model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={self.api_key}"
        )
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                candidates = data.get("candidates") or []
                if not candidates:
                    raise ProviderUnavailable("Gemini returned no candidates")
                parts = candidates[0].get("content", {}).get("parts") or []
                return "".join(p.get("text", "") for p in parts)
        except ProviderUnavailable:
            raise
        except Exception as exc:
            raise ProviderUnavailable(f"Gemini unavailable: {exc}") from exc
