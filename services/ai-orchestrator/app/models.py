from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Locale = Literal["ar", "en"]

ElementCategory = Literal[
    "creature",
    "plant",
    "resource",
    "civilization",
    "city",
    "invention",
    "technology",
    "disease",
    "climate_phenomenon",
    "natural_law",
    "disaster",
    "alliance",
    "culture",
    "language",
    "transport",
    "energy",
    "custom",
]

BiomeType = Literal[
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


class ElementTraits(BaseModel):
    size: float = Field(default=0.5, ge=0, le=1)
    growthRate: float = Field(default=0.5, ge=0, le=1)
    waterNeed: float = Field(default=0.5, ge=0, le=1)
    heatResistance: float = Field(default=0.5, ge=0, le=1)
    coldResistance: float = Field(default=0.5, ge=0, le=1)
    aggression: float | None = Field(default=None, ge=0, le=1)
    intelligence: float | None = Field(default=None, ge=0, le=1)
    pollutionAbsorption: float | None = Field(default=None, ge=0, le=1)
    nightLuminosity: float | None = Field(default=None, ge=0, le=1)
    energyOutput: float | None = Field(default=None, ge=0, le=1)
    fertility: float | None = Field(default=None, ge=0, le=1)
    adaptability: float | None = Field(default=None, ge=0, le=1)

    model_config = ConfigDict(extra="allow")


class StructuredElement(BaseModel):
    category: ElementCategory
    name: str = Field(min_length=1, max_length=80)
    nameAr: str | None = Field(default=None, max_length=80)
    nameEn: str | None = Field(default=None, max_length=80)
    description: str = Field(min_length=1, max_length=1000)
    traits: ElementTraits = Field(default_factory=ElementTraits)
    possibleBiomes: list[BiomeType] = Field(default_factory=lambda: ["plains"])
    risks: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    balanceScore: float = Field(default=0.5, ge=0, le=1)
    wasBalanced: bool = False
    balanceNotes: list[str] | None = None

    @field_validator("possibleBiomes")
    @classmethod
    def require_biome(cls, value: list[BiomeType]) -> list[BiomeType]:
        return value or ["plains"]


class ModerationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    locale: Locale | None = None


class ModerationResult(BaseModel):
    allowed: bool
    flags: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    severity: float = Field(default=0, ge=0, le=1)


class ModerationResponse(BaseModel):
    moderation: ModerationResult


class ParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    locale: Locale | None = None
    category_hint: ElementCategory | None = None


class ParseResponse(BaseModel):
    element: StructuredElement
    moderation: ModerationResult
    provider: str
    sandbox: bool


class BalanceRequest(BaseModel):
    element: StructuredElement


class BalanceResponse(BaseModel):
    element: StructuredElement
    notes: list[str] = Field(default_factory=list)
    rejected: bool = False


class NarrateRequest(BaseModel):
    events: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    locale: Locale | None = None


class NarrateResponse(BaseModel):
    story: str
    used_event_count: int
    used_metric_keys: list[str] = Field(default_factory=list)


class AnalyzeContributionRequest(ParseRequest):
    pass


class AnalyzeContributionResponse(BaseModel):
    moderation: ModerationResult
    parsed: StructuredElement | None = None
    balanced: StructuredElement | None = None
    balance_notes: list[str] = Field(default_factory=list)
    rejected: bool = False
    provider: str
    sandbox: bool
