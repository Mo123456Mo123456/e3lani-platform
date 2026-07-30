"""
Scientific simulation sidecar (FastAPI).
The TypeScript engine remains authoritative for product ticks;
this service exposes optional numerical helpers (Lotka–Volterra, climate CA).
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Planet Scientific Sidecar", version="0.1.0")


class LotkaInput(BaseModel):
    prey: float = Field(gt=0)
    predator: float = Field(gt=0)
    alpha: float = 1.1
    beta: float = 0.4
    delta: float = 0.1
    gamma: float = 0.4
    steps: int = Field(default=20, ge=1, le=500)


@app.get("/health")
def health():
    return {"ok": True, "role": "scientific_sidecar"}


@app.post("/v1/lotka-volterra")
def lotka(input: LotkaInput):
    prey, predator = input.prey, input.predator
    series = []
    for _ in range(input.steps):
        d_prey = input.alpha * prey - input.beta * prey * predator
        d_pred = input.delta * prey * predator - input.gamma * predator
        prey = max(0.0, prey + d_prey * 0.02)
        predator = max(0.0, predator + d_pred * 0.02)
        series.append({"prey": prey, "predator": predator})
    return {"series": series}


class ClimateCell(BaseModel):
    moisture: float
    temperature: float
    pollution: float


class ClimateStep(BaseModel):
    grid: list[list[ClimateCell]]


@app.post("/v1/climate-ca-step")
def climate_step(body: ClimateStep):
    g = body.grid
    h = len(g)
    w = len(g[0]) if h else 0
    out: list[list[dict]] = []
    for y in range(h):
        row = []
        for x in range(w):
            cell = g[y][x]
            neighbors = []
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        neighbors.append(g[ny][nx])
            avg_m = sum(n.moisture for n in neighbors) / max(1, len(neighbors))
            avg_p = sum(n.pollution for n in neighbors) / max(1, len(neighbors))
            moisture = max(0.0, min(1.0, cell.moisture * 0.8 + avg_m * 0.2 - cell.pollution * 0.01))
            pollution = max(0.0, min(1.0, cell.pollution * 0.9 + avg_p * 0.05))
            temperature = max(0.0, min(1.0, cell.temperature + pollution * 0.01 - moisture * 0.005))
            row.append(
                {
                    "moisture": moisture,
                    "temperature": temperature,
                    "pollution": pollution,
                }
            )
        out.append(row)
    return {"grid": out}
