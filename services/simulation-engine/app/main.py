"""Scientific simulation service (FastAPI).

Heavy, CPU-bound world analysis — Monte Carlo futures over compressed world
summaries. The live tick engine remains the TypeScript canonical engine
(packages/simulation-models); this service exists so expensive analysis can
scale out independently, per the architecture's engine-separation rule.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import ScenarioReport, ScenarioRequest
from .projection import run_scenarios

app = FastAPI(title="Planet Genesis — Simulation Engine (Scientific)", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "engine": "python-simulation-engine/0.1"}


@app.post("/v1/scenarios", response_model=ScenarioReport)
async def scenarios(request: ScenarioRequest) -> ScenarioReport:
    return run_scenarios(
        world=request.world,
        contribution=request.contribution,
        horizon=request.horizon_ticks,
        runs=request.runs,
    )
