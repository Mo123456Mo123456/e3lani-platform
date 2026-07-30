from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .events import SimulationEvent


class StructuredElement(BaseModel):
    """Accepts both engine-native and AI-orchestrator element shapes."""

    id: str | None = None
    type: str | None = None
    name: str
    category: str | None = None
    description: str | None = None
    labels: dict[str, str] = Field(default_factory=dict)
    properties: dict[str, Any] = Field(default_factory=dict)
    traits: dict[str, Any] = Field(default_factory=dict)
    possibleBiomes: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    balanceScore: float | None = None
    wasBalanced: bool | None = None

    def normalized_type(self) -> str:
        return (self.type or self.category or "custom").lower()

    def merged_properties(self) -> dict[str, Any]:
        merged = {k: v for k, v in self.properties.items() if v is not None}
        for key, value in self.traits.items():
            if value is None:
                continue
            merged.setdefault(key, value)
            # camelCase → snake helpers used by effect_profile
            if key == "growthRate":
                merged.setdefault("growth_rate", value)
            if key == "waterNeed":
                merged.setdefault("water_need", value)
            if key == "pollutionAbsorption":
                merged.setdefault("pollution", -abs(float(value)) * 0.05)
                merged.setdefault("pollutionAbsorption", value)
            if key == "energyOutput":
                merged.setdefault("economy_delta", float(value) * 0.01)
            if key == "fertility":
                merged.setdefault("fertility_delta", float(value) * 0.02)
        return merged


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
    external_planet_id: str | None = None


class WorldEnsureRequest(BaseModel):
    seed: str
    planet_id: str | None = None
    resolution: tuple[int, int] | None = None


class TickRequest(BaseModel):
    planet_id: str
    ticks: int = Field(default=1, ge=1, le=5000)
    steps: int | None = None
    unit: Literal["tick", "year", "month", "day"] = "year"
    seed: str | None = None


class ContributionApplyRequest(BaseModel):
    planet_id: str
    contribution: StructuredElement | None = None
    element: StructuredElement | None = None
    region_id: str | None = None
    regionId: str | None = None
    user_id: str | None = None
    userId: str | None = None
    seed: str | None = None
    lat: float | None = None
    lon: float | None = None
    gridX: int | None = None
    gridY: int | None = None

    def resolved_element(self) -> StructuredElement:
        element = self.contribution or self.element
        if element is None:
            raise ValueError("contribution or element is required")
        return element

    def resolved_user_id(self) -> str:
        return self.user_id or self.userId or "anonymous"

    def resolved_region_id(self) -> str | None:
        return self.region_id or self.regionId


class ForecastRequest(BaseModel):
    planet_id: str
    contribution_id: str | None = None
    contributionId: str | None = None
    horizons: list[int] = Field(default_factory=lambda: [1, 10, 100, 1000])
    seed: str | None = None
    region_id: str | None = None
    regionId: str | None = None
    element: StructuredElement | None = None
    mode: str | None = None


class RollbackRequest(BaseModel):
    planet_id: str
    snapshot_id: str | None = None
    snapshotId: str | None = None
    targetTick: int | None = None
    reason: str | None = None

