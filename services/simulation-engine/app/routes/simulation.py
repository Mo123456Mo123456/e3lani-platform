"""Simulation HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..engine import engine
from ..schemas import (
    ForecastRequest,
    ForecastResponse,
    InjectElementRequest,
    RebuildRequest,
    SimulateResponse,
    SimulateTicksRequest,
    StateResponse,
)

router = APIRouter(prefix="/simulate", tags=["simulation"])


@router.post("/ticks", response_model=SimulateResponse)
def simulate_ticks(body: SimulateTicksRequest) -> SimulateResponse:
    engine.create_or_get(body.planet_id, body.seed, width=body.width, height=body.height)
    result = engine.run_ticks(body.planet_id, body.ticks)
    return SimulateResponse(**result)


@router.post("/inject")
def simulate_inject(body: InjectElementRequest) -> dict:
    engine.create_or_get(body.planet_id, body.seed, width=body.width, height=body.height)
    record = engine.inject_element(
        body.planet_id,
        {
            "name": body.name,
            "category": body.category,
            "traits": body.traits,
            "possibleBiomes": body.possibleBiomes,
            "risks": body.risks,
        },
    )
    return {"ok": True, "event": record, "summary": engine.worlds[body.planet_id].summary()}


@router.post("/forecast", response_model=ForecastResponse)
def simulate_forecast(body: ForecastRequest) -> ForecastResponse:
    engine.create_or_get(body.planet_id, body.seed, width=body.width, height=body.height)
    result = engine.forecast(body.planet_id, ticks=body.ticks, samples=body.samples)
    return ForecastResponse(**result)


@router.post("/rebuild", response_model=StateResponse)
def simulate_rebuild(body: RebuildRequest) -> StateResponse:
    if body.planet_id not in engine.worlds:
        # Allow rebuild from empty by creating then immediately rebuilding tick 0
        engine.create_or_get(body.planet_id, body.seed, width=body.width, height=body.height)
    result = engine.rebuild(body.planet_id, body.seed, width=body.width, height=body.height)
    return StateResponse(**result)


@router.get("/state/{planet_id}", response_model=StateResponse)
def simulate_state(planet_id: str) -> StateResponse:
    try:
        result = engine.get_state(planet_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StateResponse(**result)
