from __future__ import annotations

import os
from typing import Annotated

import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from app.generator import generate


class GenerateRequest(BaseModel):
    seed: str = Field(default="planet-born-alpha-2026", min_length=1)
    resolution: tuple[int, int] = Field(default=(12, 24))


app = FastAPI(
    title="كوكب يولد أمامك - World Generator",
    version="0.1.0",
    description="Thin generation facade that can proxy the simulation engine or provide a deterministic lightweight generator.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "world-generator", "mode": os.getenv("WORLD_GENERATOR_MODE", "local")}


async def proxy_to_simulation(request: GenerateRequest) -> dict[str, object]:
    simulation_url = os.getenv("SIMULATION_URL", "http://localhost:8001").rstrip("/")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{simulation_url}/world/generate",
            json={"seed": request.seed, "resolution": list(request.resolution)},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()


@app.post("/generate")
async def post_generate(request: GenerateRequest) -> dict[str, object]:
    if os.getenv("WORLD_GENERATOR_MODE") == "proxy":
        return await proxy_to_simulation(request)

    rows, cols = request.resolution
    return generate(request.seed, rows, cols)


@app.get("/generate")
def get_generate(
    seed: Annotated[str, Query(min_length=1)] = "planet-born-alpha-2026",
    rows: Annotated[int, Query(ge=2, le=96)] = 12,
    cols: Annotated[int, Query(ge=2, le=192)] = 24,
) -> dict[str, object]:
    return generate(seed, rows, cols)
