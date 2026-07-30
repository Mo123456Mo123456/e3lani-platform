"""Simulation engine HTTP boundary (FastAPI).

The engine is a pure compute service: state goes in, state + causal
events come out. Persistence, auth and scheduling live in the API
service; determinism is guaranteed by the seed-driven core.
"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from . import __version__
from .engine import MAX_TICKS_PER_CALL, advance, run_history
from .events import ALL_EVENT_TYPES
from .generator import generate_world
from .inject import CATEGORIES, assess_contribution, inject_contribution
from .maps import LAYERS, render_layers
from .rng import hash_state
from .scenarios import DEFAULT_HORIZONS, run_scenarios

app = FastAPI(title="Planet Born — Simulation Engine", version=__version__)


class GenerateRequest(BaseModel):
    seed: int = 42
    params: dict[str, Any] | None = None


class Contribution(BaseModel):
    id: str | None = None
    category: str
    name: str = Field(min_length=1, max_length=140)
    traits: dict[str, float | str] = Field(default_factory=dict)
    possibleBiomes: list[str] | None = None
    targetCellId: int | None = None
    locale: str = "ar"

    @field_validator("category")
    @classmethod
    def _cat(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"unknown category {v!r}; allowed: {CATEGORIES}")
        return v


class AdvanceRequest(BaseModel):
    state: dict[str, Any]
    ticks: int = Field(default=1, ge=1, le=MAX_TICKS_PER_CALL)


class InjectRequest(BaseModel):
    state: dict[str, Any]
    contribution: Contribution
    assess: bool = True


class AssessRequest(BaseModel):
    state: dict[str, Any]
    contribution: Contribution


class ScenariosRequest(BaseModel):
    state: dict[str, Any]
    contribution: Contribution | None = None
    horizons: list[int] | None = None
    runs: int = Field(default=8, ge=2, le=16)


class ReplayRequest(BaseModel):
    seed: int = 42
    ticks: int = Field(default=100, ge=0, le=MAX_TICKS_PER_CALL)
    injections: list[dict[str, Any]] = Field(default_factory=list)
    params: dict[str, Any] | None = None


class MapsRequest(BaseModel):
    state: dict[str, Any]
    layers: list[str] | None = None
    scale: int = Field(default=4, ge=1, le=8)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "simulation-engine", "version": __version__}


@app.get("/meta")
def meta() -> dict[str, Any]:
    return {
        "eventTypes": ALL_EVENT_TYPES,
        "contributionCategories": CATEGORIES,
        "mapLayers": LAYERS,
        "defaultHorizons": DEFAULT_HORIZONS,
    }


@app.post("/generate")
def generate(req: GenerateRequest) -> dict[str, Any]:
    state = generate_world(req.seed, req.params)
    return {
        "state": state,
        "events": state["events"],
        "hash": hash_state(state),
        "summary": _summary(state),
    }


@app.post("/advance")
def advance_endpoint(req: AdvanceRequest) -> dict[str, Any]:
    _require_state(req.state)
    state, new_events = advance(req.state, req.ticks)
    return {"state": state, "events": new_events, "hash": hash_state(state)}


@app.post("/inject")
def inject(req: InjectRequest) -> dict[str, Any]:
    _require_state(req.state)
    assessment = assess_contribution(req.state, req.contribution.model_dump()) if req.assess else None
    result = inject_contribution(req.state, req.contribution.model_dump())
    return {
        "state": result["state"],
        "events": result["events"],
        "contributionId": result["contributionId"],
        "assessment": assessment,
        "hash": hash_state(result["state"]),
    }


@app.post("/assess")
def assess(req: AssessRequest) -> dict[str, Any]:
    _require_state(req.state)
    return {"assessment": assess_contribution(req.state, req.contribution.model_dump())}


@app.post("/scenarios")
def scenarios(req: ScenariosRequest) -> dict[str, Any]:
    _require_state(req.state)
    report = run_scenarios(
        req.state,
        contribution=req.contribution.model_dump() if req.contribution else None,
        horizons=req.horizons,
        runs=req.runs,
    )
    return {"report": report}


@app.post("/replay")
def replay(req: ReplayRequest) -> dict[str, Any]:
    state = run_history(req.seed, req.ticks, req.injections, req.params)
    return {"state": state, "hash": hash_state(state), "summary": _summary(state)}


@app.post("/maps")
def maps(req: MapsRequest) -> dict[str, Any]:
    _require_state(req.state)
    return {"layers": render_layers(req.state, req.layers, req.scale),
            "tick": req.state["meta"]["tick"]}


def _require_state(state: dict[str, Any]) -> None:
    if "meta" not in state or "cells" not in state:
        raise HTTPException(status_code=422, detail="invalid world state payload")


def _summary(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "tick": state["meta"]["tick"],
        "seed": state["meta"]["seed"],
        "civilizations": sum(1 for c in state["civilizations"].values() if not c["extinct"]),
        "cities": len(state["cities"]),
        "species": sum(1 for s in state["species"].values() if not s["extinct"]),
        "plants": sum(1 for p in state["plants"].values() if not p["extinct"]),
        "technologies": len(state["technologies"]),
        "activeWars": sum(1 for w in state["wars"].values() if w["active"]),
        "events": len(state["events"]),
        "tempShift": state["meta"]["globalTempShift"],
    }
