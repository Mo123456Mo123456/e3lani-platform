"""OpenAI adapter — structured output enforced via JSON Schema response_format."""
from __future__ import annotations

import json
from typing import List, Optional

import httpx

from ..schemas import CONTRIBUTION_JSON_SCHEMA, Category, StructuredContribution
from .base import ProviderError

SYSTEM_PROMPT = """You are the contribution parser of a living-planet simulation.
Convert the user's free-text idea (Arabic or English) into a structured game
element. All trait values must be floats in [0,1]. Keep the element balanced:
no immortality, no infinite energy, no unbounded reproduction. Infer the most
suitable biomes and realistic ecological/economic risks. Output JSON only."""


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", base_url: str = "https://api.openai.com"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def parse_contribution(self, text: str, category: Optional[Category], locale: str) -> StructuredContribution:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"locale={locale}; category_hint={category.value if category else 'auto'}\nidea: {text}"},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_contribution",
                    "strict": True,
                    "schema": CONTRIBUTION_JSON_SCHEMA,
                },
            },
            "temperature": 0.2,
        }
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers={"authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
        if response.status_code != 200:
            raise ProviderError(f"openai {response.status_code}: {response.text[:200]}")
        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            # model may wrap in an object keyed by the schema name
            if "structured_contribution" in parsed:
                parsed = parsed["structured_contribution"]
            return StructuredContribution.model_validate(parsed)
        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            raise ProviderError(f"openai malformed response: {exc}") from exc

    async def narrate(self, contribution_name: str, facts: List[str], locale: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": (
                    "You narrate simulation results. You may ONLY mention the facts "
                    "listed by the user; inventing events is forbidden. "
                    + ("Write in Arabic." if locale == "ar" else "Write in English.")
                )},
                {"role": "user", "content": f"element: {contribution_name}\nfacts:\n" + "\n".join(facts)},
            ],
            "temperature": 0.6,
        }
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers={"authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
        if response.status_code != 200:
            raise ProviderError(f"openai {response.status_code}")
        return response.json()["choices"][0]["message"]["content"].strip()
