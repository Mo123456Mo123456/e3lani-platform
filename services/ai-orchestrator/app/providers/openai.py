"""OpenAI adapter (used only when OPENAI_API_KEY is configured)."""
from __future__ import annotations

import json
import os
from typing import Any

import httpx

from ..narrative import template_narrative
from ..schemas import StructuredContribution
from .prompts import PARSE_SYSTEM, NARRATE_SYSTEM, events_block

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class OpenAIProvider:
    name = "openai"

    def configured(self) -> bool:
        return bool(os.getenv("OPENAI_API_KEY"))

    def parse_contribution(self, text: str, locale: str, category: str | None) -> StructuredContribution:
        from .mock import MockProvider
        fallback = MockProvider().parse_contribution(text, locale, category)
        try:
            raw = self._chat(PARSE_SYSTEM, json.dumps({
                "text": text, "locale": locale, "categoryHint": category,
                "draft": fallback.model_dump(),
            }, ensure_ascii=False))
            data = json.loads(raw)
            data["provider"] = self.name
            data["sandbox"] = False
            data.setdefault("traits", fallback.traits)
            data.setdefault("possibleBiomes", fallback.possibleBiomes)
            data.setdefault("risks", fallback.risks)
            return StructuredContribution(**data)
        except Exception:
            return fallback

    def narrate(self, events: list[dict[str, Any]], locale: str) -> str:
        try:
            return self._chat(NARRATE_SYSTEM, events_block(events, locale))
        except Exception:
            return template_narrative(events, locale)

    def _chat(self, system: str, user: str) -> str:
        with httpx.Client(timeout=30) as client:
            res = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
                json={
                    "model": MODEL,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "max_tokens": int(os.getenv("AI_MAX_TOKENS", "2048")),
                },
            )
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"]
