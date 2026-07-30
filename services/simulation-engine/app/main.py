from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .engine import engine
from .models import (
    ContributionApplyRequest,
    ForecastRequest,
    RollbackRequest,
    TickRequest,
    WorldEnsureRequest,
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
        state = engine.generate_world(
            request.seed,
            request.resolution,
            external_planet_id=request.external_planet_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return state


@app.post("/world/ensure")
def ensure_world(request: WorldEnsureRequest):
    try:
        state = engine.ensure_world(request.seed, request.planet_id, request.resolution)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "planet_id": state.planet_id,
        "seed": state.seed,
        "tick": state.tick,
        "resolution": state.resolution,
        "metrics": state.metrics,
        "region_count": len(state.regions),
        "civilization_count": len(state.civilizations),
    }


@app.get("/world/{planet_id}/state")
def get_world_state(planet_id: str):
    try:
        return engine.get_state(planet_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/simulate/tick")
def simulate_tick(request: TickRequest):
    ticks = request.steps or request.ticks
    try:
        state = engine.simulate_ticks(request.planet_id, ticks, request.unit, seed=request.seed)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "planet_id": state.planet_id,
        "tick": state.tick,
        "year": state.tick,
        "metrics": state.metrics,
        "events": state.events[-min(50, len(state.events)) :],
        "snapshot_ids": list(state.snapshots.keys())[-5:],
    }


@app.post("/contribute/apply")
def apply_contribution(request: ContributionApplyRequest):
    try:
        element = request.resolved_element()
        record, state = engine.apply_contribution(
            request.planet_id,
            element,
            request.resolved_region_id(),
            request.resolved_user_id(),
            seed=request.seed,
            lat=request.lat,
            lon=request.lon,
            grid_x=request.gridX,
            grid_y=request.gridY,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "planet_id": state.planet_id,
        "tick": state.tick,
        "year": state.tick,
        "contribution": record,
        "events": [event for event in state.events if event.id in record.event_ids],
        "metrics": state.metrics,
        "causal_edges": [edge.model_dump() for edge in state.causal_edges[-40:]],
    }


@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        if request.seed:
            engine.ensure_world(request.seed, planet_id=request.planet_id)
        return engine.forecast(
            request.planet_id,
            request.contribution_id or request.contributionId,
            request.horizons,
            seed=request.seed,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/rollback")
def rollback(request: RollbackRequest):
    snapshot_id = request.snapshot_id or request.snapshotId
    if not snapshot_id:
        raise HTTPException(status_code=400, detail="snapshot_id is required")
    try:
        state = engine.rollback(request.planet_id, snapshot_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "planet_id": state.planet_id,
        "tick": state.tick,
        "metrics": state.metrics,
        "events": state.events[-20:],
    }
