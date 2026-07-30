from __future__ import annotations

import re
from typing import Any

from app.models import Locale


ARABIC_RE = re.compile(r"[\u0600-\u06ff]")
SPACE_RE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    return SPACE_RE.sub(" ", text).strip()


def detect_locale(text: str, locale: Locale | None = None) -> Locale:
    if locale in ("ar", "en"):
        return locale
    return "ar" if ARABIC_RE.search(text) else "en"


def clamp(value: float, low: float = 0, high: float = 1) -> float:
    return max(low, min(high, value))


def has_any(text: str, keywords: list[str]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def stringify_fact(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float, str)):
        return str(value)
    if value is None:
        return "null"
    if isinstance(value, list):
        return ", ".join(stringify_fact(item) for item in value[:5])
    if isinstance(value, dict):
        parts = [f"{key}: {stringify_fact(item)}" for key, item in list(value.items())[:5]]
        return "; ".join(parts)
    return str(value)
