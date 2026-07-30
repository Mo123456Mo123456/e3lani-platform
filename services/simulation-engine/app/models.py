from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .events import SimulationEvent


class StructuredElement(BaseModel):
    id: str | None = None
    type: str
    name: str
    category: str | None = None
    labels: dict[str, str] = Field(default_factory=dict)
    properties: dict[str, Any] = Field(default_factory=dict)


class Region(BaseModel):
    id: str
    x: int
    y: int
    height: float
    moisture: float
    temperature: float
    biome: str
    fertility: float
    pollution: float = 0.0
    storm_energy: float = 0.0
    drought: float = 0.0
    population: float = 0.0
    owner_civ_id: str | None = None
    resources: dict[str, float] = Field(default_factory=dict)
    neighbors: list[str] = Field(default_factory=list)
    labels: dict[str, str] = Field(default_factory=dict)


class Species(BaseModel):
    id: str
    name: str
    kind: Literal["plant", "herbivore", "carnivore"]
    population: float
    biomass: float
    growth_rate: float
    mortality_rate: float
    carrying_capacity: float
    region_ids: list[str]
    prey_ids: list[str] = Field(default_factory=list)
    mutation_index: float = 0.0
    labels: dict[str, str] = Field(default_factory=dict)


class City(BaseModel):
    id: str
    name: str
    civ_id: str
    region_id: str
    population: float
    infrastructure: float
    wealth: float
    labels: dict[str, str] = Field(default_factory=dict)


class Civilization(BaseModel):
    id: str
    name: str
    capital_region_id: str
    city_ids: list[str]
    population: float
    technology: float
    aggression: float
    cooperation: float
    economy: float
    food: float
    resources: dict[str, float] = Field(default_factory=dict)
    alliances: list[str] = Field(default_factory=list)
    at_war: list[str] = Field(default_factory=list)
    stability: float = 0.75
    labels: dict[str, str] = Field(default_factory=dict)


class TradeRoute(BaseModel):
    id: str
    city_a: str
    city_b: str
    path: list[str]
    distance: float
    volume: float
    resource: str


class CausalEdge(BaseModel):
    source: str
    target: str
    weight: float
    relation: str


class ContributionRecord(BaseModel):
    id: str
    user_id: str
    region_id: str
    tick: int
    element: StructuredElement
    effects: dict[str, float]
    affected_regions: dict[str, dict[str, float]]
    event_ids: list[str]


class SnapshotRecord(BaseModel):
    id: str
    tick: int
    path: str


class PlanetState(BaseModel):
    planet_id: str
    seed: str
    resolution: tuple[int, int]
    tick: int = 0
    regions: dict[str, Region] = Field(default_factory=dict)
    species: dict[str, Species] = Field(default_factory=dict)
    civilizations: dict[str, Civilization] = Field(default_factory=dict)
    cities: dict[str, City] = Field(default_factory=dict)
    resources: dict[str, dict[str, float]] = Field(default_factory=dict)
    trade_routes: list[TradeRoute] = Field(default_factory=list)
    causal_edges: list[CausalEdge] = Field(default_factory=list)
    contributions: dict[str, ContributionRecord] = Field(default_factory=dict)
    snapshots: dict[str, SnapshotRecord] = Field(default_factory=dict)
    events: list[SimulationEvent] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)


class WorldGenerateRequest(BaseModel):
    seed: str
    resolution: tuple[int, int] | None = None


class TickRequest(BaseModel):
    planet_id: str
    ticks: int = Field(default=1, ge=1, le=5000)
    unit: Literal["tick", "year", "month", "day"] = "year"


class ContributionApplyRequest(BaseModel):
    planet_id: str
    contribution: StructuredElement
    region_id: str
    user_id: str


class ForecastRequest(BaseModel):
    planet_id: str
    contribution_id: str | None = None
    horizons: list[int] = Field(default_factory=lambda: [1, 10, 100, 1000])


class RollbackRequest(BaseModel):
    planet_id: str
    snapshot_id: str

