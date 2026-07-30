"""Scientific simulation helpers (Python) — mirrors TS engine for heavy numeric work."""
from __future__ import annotations

from typing import Any

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Planet Simulation Engine", version="0.1.0")


class LotkaVolterraIn(BaseModel):
    prey: float = Field(gt=0)
    predator: float = Field(ge=0)
    alpha: float = 0.4
    beta: float = 0.002
    delta: float = 0.0015
    gamma: float = 0.3
    steps: int = Field(default=50, ge=1, le=1000)
    dt: float = 0.1


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "simulation-engine"}


@app.post("/ecology/lotka-volterra")
def lotka(body: LotkaVolterraIn) -> dict[str, Any]:
    """Deterministic Lotka–Volterra integration for ecology subsystems."""
    x, y = body.prey, body.predator
    xs, ys = [x], [y]
    for _ in range(body.steps):
        dx = body.alpha * x - body.beta * x * y
        dy = body.delta * x * y - body.gamma * y
        x = max(0.0, x + dx * body.dt)
        y = max(0.0, y + dy * body.dt)
        xs.append(x)
        ys.append(y)
    return {
        "prey": xs,
        "predator": ys,
        "finalPrey": xs[-1],
        "finalPredator": ys[-1],
    }


class WarOddsIn(BaseModel):
    aggressionA: float
    aggressionB: float
    militaryA: float
    militaryB: float
    foodA: float
    foodB: float
    allied: bool = False
    proximity: float = 0.2
    historyAttacks: int = 0
    sharedResources: int = 0


@app.post("/conflict/probability")
def war_probability(body: WarOddsIn) -> dict[str, float]:
    p = (
        0.05
        + body.aggressionA * 0.2
        + body.proximity
        + max(0.0, 0.4 - body.foodA) * 0.2
        + max(0.0, 0.4 - body.foodB) * 0.2
        + body.historyAttacks * 0.15
        + (0.1 if body.sharedResources > 5 else 0.0)
        - (0.5 if body.allied else 0.0)
        - abs(body.militaryA - body.militaryB) * 0.05
    )
    return {"probability": float(np.clip(p, 0.0, 1.0))}


class ClimateStepIn(BaseModel):
    temperature: list[float]
    moisture: list[float]
    pollution: list[float]
    seed: int = 42


@app.post("/climate/step")
def climate_step(body: ClimateStepIn) -> dict[str, Any]:
    rng = np.random.default_rng(body.seed)
    t = np.array(body.temperature, dtype=float)
    m = np.array(body.moisture, dtype=float)
    p = np.array(body.pollution, dtype=float)
    t = np.clip(t + rng.uniform(-0.01, 0.01, size=t.shape) - p * 0.002, 0, 1)
    m = np.clip(m + rng.uniform(-0.01, 0.01, size=m.shape) - p * 0.001, 0, 1)
    # Cellular-automata-ish diffusion
    if len(t) > 2:
        t = 0.7 * t + 0.15 * np.roll(t, 1) + 0.15 * np.roll(t, -1)
        m = 0.7 * m + 0.15 * np.roll(m, 1) + 0.15 * np.roll(m, -1)
    return {
        "temperature": t.tolist(),
        "moisture": m.tolist(),
        "pollution": p.tolist(),
    }
