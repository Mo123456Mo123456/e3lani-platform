from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal[
    "creature",
    "plant",
    "resource",
    "civilization",
    "invention",
    "natural_phenomenon",
    "disease",
    "culture",
    "world_law",
    "custom",
]

Biome = Literal[
    "ocean",
    "coast",
    "plains",
    "rainforest",
    "temperate_forest",
    "desert",
    "mountain",
    "tundra",
    "wetland",
    "steppe",
    "volcanic",
    "ice",
]


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Category
    idea: str = Field(min_length=10, max_length=2_000)
    locale: Literal["ar", "en"] = "ar"


class Traits(BaseModel):
    model_config = ConfigDict(extra="forbid")

    size: float = Field(default=0.5, ge=0, le=1)
    growthRate: float = Field(default=0.5, ge=0, le=1)
    waterNeed: float = Field(default=0.5, ge=0, le=1)
    pollutionAbsorption: float = Field(default=0, ge=0, le=1)
    nightLuminosity: float = Field(default=0, ge=0, le=1)
    coldResistance: float = Field(default=0.5, ge=0, le=1)
    heatResistance: float = Field(default=0.5, ge=0, le=1)
    aggression: float = Field(default=0, ge=0, le=1)
    intelligence: float = Field(default=0, ge=0, le=1)
    adaptability: float = Field(default=0.5, ge=0, le=1)
    energyYield: float = Field(default=0, ge=0, le=1)
    contagion: float = Field(default=0, ge=0, le=1)


class Moderation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accepted: bool
    reasons: list[str] = Field(default_factory=list, max_length=8)
    adjusted: bool = False


class ContributionAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Category
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=3, max_length=1_000)
    traits: Traits
    possibleBiomes: list[Biome] = Field(min_length=1, max_length=6)
    risks: list[str] = Field(default_factory=list, max_length=8)
    benefits: list[str] = Field(default_factory=list, max_length=8)
    balanceScore: float = Field(ge=0, le=1)
    moderation: Moderation
    provider: str
    sandbox: bool


class NarrativeEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: str
    cause: str
    year: int
    payload: dict[str, object]
    directImpact: dict[str, float]


class NarrativeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[NarrativeEvent] = Field(min_length=1, max_length=100)
    locale: Literal["ar", "en"] = "ar"


class NarrativeResponse(BaseModel):
    narrative: str
    citedEventIds: list[str]
    provider: str
    sandbox: bool
