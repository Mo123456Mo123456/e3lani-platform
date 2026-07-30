from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .engine import engine
from .models import (
    ContributionApplyRequest,
    ForecastRequest,
    RollbackRequest,
    TickRequest,
    WorldGenerateRequest,
)

app = FastAPI(
    title="كوكب يولد أمامك - Simulation Engine",
    description="Deterministic procedural planet simulation engine.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "simulation-engine"}


@app.post("/world/generate")
def generate_world(request: WorldGenerateRequest):
    try:
        return engine.generate_world(request.seed, request.resolution)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/world/{planet_id}/state")
def get_world_state(planet_id: str):
    try:
        return engine.get_state(planet_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/simulate/tick")
def simulate_tick(request: TickRequest):
    try:
        state = engine.simulate_ticks(request.planet_id, request.ticks, request.unit)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "planet_id": state.planet_id,
        "tick": state.tick,
        "metrics": state.metrics,
        "events": state.events[-min(50, len(state.events)) :],
        "snapshot_ids": list(state.snapshots.keys())[-5:],
    }


@app.post("/contribute/apply")
def apply_contribution(request: ContributionApplyRequest):
    try:
        record, state = engine.apply_contribution(
            request.planet_id,
            request.contribution,
            request.region_id,
            request.user_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "planet_id": state.planet_id,
        "tick": state.tick,
        "contribution": record,
        "events": [event for event in state.events if event.id in record.event_ids],
        "metrics": state.metrics,
    }


@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        return engine.forecast(request.planet_id, request.contribution_id, request.horizons)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/rollback")
def rollback(request: RollbackRequest):
    try:
        state = engine.rollback(request.planet_id, request.snapshot_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "planet_id": state.planet_id,
        "tick": state.tick,
        "metrics": state.metrics,
        "snapshot_ids": list(state.snapshots.keys())[-5:],
    }

