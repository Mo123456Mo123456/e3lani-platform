"""Anthropic adapter — structured output via forced tool use."""
from __future__ import annotations

from typing import List, Optional

import httpx

from ..schemas import CONTRIBUTION_JSON_SCHEMA, Category, StructuredContribution
from .base import ProviderError

SYSTEM_PROMPT = """You are the contribution parser of a living-planet simulation.
Convert the user's idea (Arabic or English) into a structured element by
calling the record_contribution tool. Trait values are floats in [0,1]; keep
the element balanced (no immortality, infinite energy or unbounded spread)."""


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-5", base_url: str = "https://api.anthropic.com"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def parse_contribution(self, text: str, category: Optional[Category], locale: str) -> StructuredContribution:
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT,
            "messages": [
                {"role": "user", "content": f"locale={locale}; category_hint={category.value if category else 'auto'}\nidea: {text}"}
            ],
            "tools": [
                {
                    "name": "record_contribution",
                    "description": "Record the structured form of the user's idea.",
                    "input_schema": CONTRIBUTION_JSON_SCHEMA,
                }
            ],
            "tool_choice": {"type": "tool", "name": "record_contribution"},
        }
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"{self.base_url}/v1/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
                json=payload,
            )
        if response.status_code != 200:
            raise ProviderError(f"anthropic {response.status_code}: {response.text[:200]}")
        data = response.json()
        for block in data.get("content", []):
            if block.get("type") == "tool_use" and block.get("name") == "record_contribution":
                return StructuredContribution.model_validate(block.get("input", {}))
        raise ProviderError("anthropic response missing tool_use block")

    async def narrate(self, contribution_name: str, facts: List[str], locale: str) -> str:
        payload = {
            "model": self.model,
            "max_tokens": 600,
            "system": (
                "Narrate simulation results using ONLY the provided facts; never "
                "invent events. " + ("Write in Arabic." if locale == "ar" else "Write in English.")
            ),
            "messages": [
                {"role": "user", "content": f"element: {contribution_name}\nfacts:\n" + "\n".join(facts)}
            ],
        }
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"{self.base_url}/v1/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
                json=payload,
            )
        if response.status_code != 200:
            raise ProviderError(f"anthropic {response.status_code}")
        for block in response.json().get("content", []):
            if block.get("type") == "text":
                return block["text"].strip()
        raise ProviderError("anthropic narration missing text block")
