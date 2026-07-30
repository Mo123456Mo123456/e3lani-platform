"""AI orchestrator HTTP boundary.

Pipeline: moderation -> provider parse -> schema validation -> balance
-> causal prior. Narration is validated against real engine events.
"""
from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .balance import balance_check
from .causal import build_causal_graph
from .moderation import moderate_text
from .narrative import template_narrative, validate_narrative
from .providers import get_provider, provider_status
from .schemas import StructuredContribution

app = FastAPI(title="Planet Born — AI Orchestrator", version=__version__)

# token accounting is reported to the API (AIRequest rows); the
# orchestrator itself stays stateless
USAGE: dict[str, int] = {"parseCalls": 0, "narrateCalls": 0, "fallbacks": 0}


class ParseRequest(BaseModel):
    text: str = Field(min_length=2, max_length=1200)
    locale: str = "ar"
    category: str | None = None
    provider: str | None = None


class BalanceRequest(BaseModel):
    contribution: StructuredContribution


class CausalRequest(BaseModel):
    contribution: StructuredContribution


class NarrateRequest(BaseModel):
    events: list[dict[str, Any]]
    locale: str = "ar"
    provider: str | None = None


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=2, max_length=1200)
    locale: str = "ar"
    category: str | None = None
    provider: str | None = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "ai-orchestrator", "version": __version__}


@app.get("/providers")
def providers() -> dict[str, Any]:
    active = get_provider()
    return {
        "providers": provider_status(),
        "active": active.name,
        "sandbox": active.name == "mock",
        "usage": USAGE,
    }


@app.post("/parse")
def parse(req: ParseRequest) -> dict[str, Any]:
    moderation = moderate_text(req.text)
    if moderation.status == "block":
        raise HTTPException(status_code=422, detail={
            "error": "moderation_blocked", "reasons": moderation.reasons})
    provider = get_provider(req.provider)
    contribution = provider.parse_contribution(req.text, req.locale, req.category)
    USAGE["parseCalls"] += 1
    if provider.name == "mock":
        USAGE["fallbacks"] += 1
    return {
        "contribution": contribution.model_dump(),
        "moderation": moderation.model_dump(),
        "provider": provider.name,
        "sandbox": contribution.sandbox,
    }


@app.post("/balance")
def balance(req: BalanceRequest) -> dict[str, Any]:
    return balance_check(req.contribution)


@app.post("/causal-graph")
def causal(req: CausalRequest) -> dict[str, Any]:
    return {"graph": build_causal_graph(req.contribution).model_dump()}


@app.post("/narrate")
def narrate(req: NarrateRequest) -> dict[str, Any]:
    provider = get_provider(req.provider)
    USAGE["narrateCalls"] += 1
    if provider.name == "mock":
        text = template_narrative(req.events, req.locale)
        return {
            "text": text,
            "referencedEventIds": [e.get("id") for e in req.events[:6] if e.get("id")],
            "provider": "mock",
            "sandbox": True,
            "validated": True,
        }
    started = time.time()
    raw = provider.narrate(req.events, req.locale)
    # real providers respond with JSON {"text", "referencedEventIds"}
    import json
    try:
        data = json.loads(raw)
        text = data.get("text", "")
        refs = data.get("referencedEventIds", [])
    except (json.JSONDecodeError, AttributeError):
        text, refs = raw, []
    ok = validate_narrative(text, req.events)
    if not ok:
        USAGE["fallbacks"] += 1
        text = template_narrative(req.events, req.locale)
        refs = [e.get("id") for e in req.events[:6] if e.get("id")]
    return {
        "text": text,
        "referencedEventIds": refs,
        "provider": provider.name,
        "sandbox": False,
        "validated": ok,
        "latencyMs": int((time.time() - started) * 1000),
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict[str, Any]:
    """One-shot pipeline for the contribution wizard."""
    moderation = moderate_text(req.text)
    if moderation.status == "block":
        raise HTTPException(status_code=422, detail={
            "error": "moderation_blocked", "reasons": moderation.reasons})
    provider = get_provider(req.provider)
    contribution = provider.parse_contribution(req.text, req.locale, req.category)
    contribution.traits = contribution.normalized_traits()
    report = balance_check(contribution)
    final = contribution
    if report["verdict"] == "adjusted" and report["suggested"]:
        final = StructuredContribution(**report["suggested"])
    elif report["verdict"] == "rejected":
        return {
            "moderation": moderation.model_dump(),
            "contribution": contribution.model_dump(),
            "balance": report,
            "graph": None,
            "provider": provider.name,
            "sandbox": True,
        }
    graph = build_causal_graph(final)
    USAGE["parseCalls"] += 1
    return {
        "moderation": moderation.model_dump(),
        "contribution": final.model_dump(),
        "balance": report,
        "graph": graph.model_dump(),
        "provider": provider.name,
        "sandbox": final.sandbox,
    }
