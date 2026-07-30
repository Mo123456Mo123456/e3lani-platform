"""Gemini adapter — structured output via response_schema."""
from __future__ import annotations

import json
from typing import List, Optional

import httpx

from ..schemas import Category, StructuredContribution
from .base import ProviderError

# Gemini's response_schema uses a restricted OpenAPI subset
GEMINI_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "category": {"type": "STRING", "enum": ["creature", "plant", "resource", "civilization", "invention", "phenomenon", "disease", "culture", "law", "custom"]},
        "name": {"type": "STRING"},
        "description": {"type": "STRING"},
        "traits": {"type": "OBJECT", "properties": {}},
        "possible_biomes": {"type": "ARRAY", "items": {"type": "STRING"}},
        "risks": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["category", "name", "traits"],
}

PROMPT = """You are the contribution parser of a living-planet simulation.
Convert the idea (Arabic or English) into structured JSON. Trait values are
floats in [0,1]. Keep the element balanced: no immortality, no infinite
energy, no unbounded reproduction."""


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash", base_url: str = "https://generativelanguage.googleapis.com"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def parse_contribution(self, text: str, category: Optional[Category], locale: str) -> StructuredContribution:
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{PROMPT}\nlocale={locale}; category_hint={category.value if category else 'auto'}\nidea: {text}"}]}
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "response_schema": GEMINI_SCHEMA,
                "temperature": 0.2,
            },
        }
        url = f"{self.base_url}/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(url, json=payload)
        if response.status_code != 200:
            raise ProviderError(f"gemini {response.status_code}: {response.text[:200]}")
        data = response.json()
        try:
            raw = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw)
            return StructuredContribution.model_validate(parsed)
        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            raise ProviderError(f"gemini malformed response: {exc}") from exc

    async def narrate(self, contribution_name: str, facts: List[str], locale: str) -> str:
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": (
                    "Narrate using ONLY these facts, never invent events. "
                    + ("Write in Arabic." if locale == "ar" else "Write in English.")
                    + f"\nelement: {contribution_name}\nfacts:\n" + "\n".join(facts)
                )}]}
            ],
        }
        url = f"{self.base_url}/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(url, json=payload)
        if response.status_code != 200:
            raise ProviderError(f"gemini {response.status_code}")
        return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
