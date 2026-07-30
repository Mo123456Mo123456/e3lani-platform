"""FastAPI entrypoint for the simulation engine."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.simulation import router as simulation_router
from .schemas import HealthResponse

app = FastAPI(
    title="كوكب يولد أمامك — Simulation Engine",
    description="Deterministic planetary tick engine with ecology, climate, civs, and economy.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulation_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="simulation-engine")
