from __future__ import annotations

from typing import Any

from app.models import Locale, NarrateResponse
from app.validation import detect_locale, stringify_fact


PRIMARY_EVENT_FIELDS = ("title", "titleAr", "description", "descriptionAr", "type", "tick", "year", "importance")


def narrate(events: list[dict[str, Any]], metrics: dict[str, Any], locale: Locale | None = None) -> NarrateResponse:
    active_locale = detect_locale(_locale_seed(events, metrics), locale)
    metric_keys = sorted(str(key) for key in metrics.keys())

    if not events:
        story = (
            "لا توجد نتائج محاكاة بعد. أرسل أحداثا أو مقاييس من المحاكاة ليتم سردها."
            if active_locale == "ar"
            else "No simulation results yet. Provide simulation events or metrics to narrate."
        )
        if metrics:
            story = f"{story} {_format_metrics(metrics, active_locale)}"
        return NarrateResponse(story=story, used_event_count=0, used_metric_keys=metric_keys)

    event_lines = [_format_event(index + 1, event, active_locale) for index, event in enumerate(events)]
    metrics_line = _format_metrics(metrics, active_locale) if metrics else ""
    if active_locale == "ar":
        prefix = "سجل المحاكاة يحتوي على الحقائق التالية:"
        story = " ".join(part for part in [prefix, *event_lines, metrics_line] if part)
    else:
        prefix = "The simulation log contains these provided facts:"
        story = " ".join(part for part in [prefix, *event_lines, metrics_line] if part)
    return NarrateResponse(story=story, used_event_count=len(events), used_metric_keys=metric_keys)


def _format_event(index: int, event: dict[str, Any], locale: Locale) -> str:
    facts: list[str] = []
    for field in PRIMARY_EVENT_FIELDS:
        if field in event and event[field] not in (None, ""):
            facts.append(f"{field}: {stringify_fact(event[field])}")
    for field, value in event.items():
        if field not in PRIMARY_EVENT_FIELDS and value not in (None, ""):
            facts.append(f"{field}: {stringify_fact(value)}")
    joined = "; ".join(facts) if facts else "no event fields supplied"
    if locale == "ar":
        return f"حدث {index}: {joined}."
    return f"Event {index}: {joined}."


def _format_metrics(metrics: dict[str, Any], locale: Locale) -> str:
    if not metrics:
        return ""
    facts = "; ".join(f"{key}: {stringify_fact(value)}" for key, value in sorted(metrics.items()))
    if locale == "ar":
        return f"المقاييس المقدمة: {facts}."
    return f"Provided metrics: {facts}."


def _locale_seed(events: list[dict[str, Any]], metrics: dict[str, Any]) -> str:
    parts: list[str] = []
    for event in events:
        parts.extend(str(value) for value in event.values())
    parts.extend(str(value) for value in metrics.values())
    return " ".join(parts)
