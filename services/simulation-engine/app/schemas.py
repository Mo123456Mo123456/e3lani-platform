"""Pydantic request/response schemas for the simulation API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SimulateTicksRequest(BaseModel):
    planet_id: str = Field(..., min_length=1)
    seed: int = 42
    ticks: int = Field(1, ge=0, le=500)
    width: int = Field(32, ge=8, le=128)
    height: int = Field(32, ge=8, le=128)


class InjectElementRequest(BaseModel):
    planet_id: str
    seed: int = 42
    width: int = Field(32, ge=8, le=128)
    height: int = Field(32, ge=8, le=128)
    name: str
    category: str = "custom"
    traits: dict[str, float] = Field(default_factory=dict)
    possibleBiomes: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class ForecastRequest(BaseModel):
    planet_id: str
    seed: int = 42
    ticks: int = Field(10, ge=1, le=200)
    samples: int = Field(8, ge=1, le=64)
    width: int = Field(32, ge=8, le=128)
    height: int = Field(32, ge=8, le=128)


class RebuildRequest(BaseModel):
    planet_id: str
    seed: int
    width: int = Field(32, ge=8, le=128)
    height: int = Field(32, ge=8, le=128)


class SimulateResponse(BaseModel):
    planet_id: str
    tick: int
    summary: dict[str, Any]
    events: list[dict[str, Any]] = Field(default_factory=list)


class StateResponse(BaseModel):
    summary: dict[str, Any]
    snapshot: dict[str, Any]
    causal: list[dict[str, Any]]
    events: list[dict[str, Any]]


class ForecastResponse(BaseModel):
    planet_id: str
    from_tick: int
    horizon: int
    samples: int
    mean_temperature: float
    mean_pollution: float
    mean_species: dict[str, float]
    trajectories: list[dict[str, Any]]


class HealthResponse(BaseModel):
    status: str
    service: str
