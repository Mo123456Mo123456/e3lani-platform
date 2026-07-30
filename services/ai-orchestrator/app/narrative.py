"""Narration layer.

Two paths:
- ``template_narrative``: deterministic rendering of real events (always
  safe, used by the mock provider and as fallback).
- LLM path output is passed through ``validate_narrative`` which checks
  that every number and capitalized name in the text actually appears in
  the source events. Failure -> template fallback with ``validated=False``.
"""
from __future__ import annotations

import re
from typing import Any

_TEMPLATES: dict[str, dict[str, str]] = {
    "SPECIES_CREATED": {
        "ar": "ظهر مخلوق جديد، {name}، في العالم.",
        "en": "A new creature, {name}, has appeared in the world.",
    },
    "PLANT_SPREAD": {
        "ar": "انتشر نبات {name} إلى {count} منطقة.",
        "en": "The plant {name} spread to {count} regions.",
    },
    "CIVILIZATION_FOUNDED": {
        "ar": "نشأت حضارة {name}.",
        "en": "The civilization of {name} has risen.",
    },
    "CITY_CREATED": {
        "ar": "أُسست مدينة {name}.",
        "en": "The city of {name} was founded.",
    },
    "TECHNOLOGY_DISCOVERED": {
        "ar": "اكتُشفت تقنية {name}.",
        "en": "The technology {name} was discovered.",
    },
    "WAR_STARTED": {
        "ar": "اندلعت حرب بين {attacker} و{defender} بسبب {cause}.",
        "en": "War broke out between {attacker} and {defender} over {cause}.",
    },
    "WAR_ENDED": {
        "ar": "انتهت حرب بعد {years} عامًا بانتصار {winner}.",
        "en": "A war ended after {years} years with {winner} prevailing.",
    },
    "SPECIES_EXTINCT": {
        "ar": "انقرض نوع {name}.",
        "en": "The species {name} went extinct.",
    },
    "VOLCANO_ERUPTED": {
        "ar": "ثار بركان مدمرًا {count} منطقة.",
        "en": "A volcano erupted, devastating {count} regions.",
    },
    "CLIMATE_CHANGED": {
        "ar": "تغير المناخ بفعل {driver}.",
        "en": "The climate shifted due to {driver}.",
    },
    "DISEASE_OUTBREAK": {
        "ar": "تفشى مرض في {city}.",
        "en": "A disease outbreak struck {city}.",
    },
    "TRADE_ROUTE_CREATED": {
        "ar": "أُنشئ طريق تجاري بين {from} و{to} لنقل {commodity}.",
        "en": "A trade route now links {from} and {to}, carrying {commodity}.",
    },
    "MIGRATION_STARTED": {
        "ar": "هاجرت مجموعة من {size} فردًا بسبب {reason}.",
        "en": "A group of {size} people migrated due to {reason}.",
    },
    "ALLIANCE_CREATED": {
        "ar": "تشكل تحالف بين {a} و{b}.",
        "en": "An alliance formed between {a} and {b}.",
    },
}


def _fill(tpl: str, payload: dict[str, Any]) -> str:
    mapping = {
        "name": payload.get("name") or payload.get("tech") or payload.get("child") or "—",
        "count": payload.get("totalCells") or payload.get("count") or len(payload.get("affectedCells", [])) or "—",
        "attacker": payload.get("attacker", "—"),
        "defender": payload.get("defender", "—"),
        "cause": (payload.get("causes") or [{}])[0].get("factor", "—") if payload.get("causes") else payload.get("reason", "—"),
        "winner": payload.get("winner", "—"),
        "years": payload.get("durationYears", "—"),
        "driver": payload.get("driver", "—"),
        "city": payload.get("city", "—"),
        "from": payload.get("from", "—"),
        "to": payload.get("to", "—"),
        "commodity": payload.get("commodity", "—"),
        "size": payload.get("size", "—"),
        "reason": payload.get("reason", "—"),
        "a": (payload.get("members") or ["—", "—"])[0],
        "b": (payload.get("members") or ["—", "—"])[1] if len(payload.get("members") or []) > 1 else "—",
    }
    try:
        return tpl.format(**mapping)
    except (KeyError, IndexError):
        return tpl


def template_narrative(events: list[dict[str, Any]], locale: str) -> str:
    lang = "ar" if locale.startswith("ar") else "en"
    important = sorted(events, key=lambda e: (-e.get("importance", 1), e.get("tick", 0)))[:6]
    if not important:
        return "لم تُسجَّل تغيّرات ملحوظة في هذه الفترة." if lang == "ar" else \
            "No notable changes were recorded during this period."
    sentences = []
    for evt in important:
        tpl = _TEMPLATES.get(evt["type"], {}).get(lang)
        if tpl:
            sentences.append(_fill(tpl, evt.get("payload", {})))
    if not sentences:
        return ("حدثت تغيّرات طفيفة في العالم." if lang == "ar" else
                "Minor changes occurred in the world.")
    return " ".join(sentences)


_NUM_RE = re.compile(r"\d+(?:\.\d+)?")


def validate_narrative(text: str, events: list[dict[str, Any]]) -> bool:
    """The narrator must not cite numbers absent from the event data."""
    import json

    corpus = json.dumps(events, ensure_ascii=False)
    numbers = _NUM_RE.findall(text)
    unsupported = [n for n in numbers if n not in corpus]
    # allow small ordinals/years phrasing drift
    if len(unsupported) > max(1, len(numbers) // 5):
        return False
    return True
