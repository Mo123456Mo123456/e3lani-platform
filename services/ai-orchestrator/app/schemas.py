"""Canonical schemas: structured contributions, balance reports,
causal graphs, narratives. Category trait specs are the single source
of truth shared (via docs + packages/validation) with the API."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

CATEGORIES = [
    "creature", "plant", "resource", "civilization", "invention",
    "natural_phenomenon", "disease", "culture", "world_law", "custom",
]

# trait name -> (min, max, default); enforced on every structured output
CATEGORY_TRAIT_SPEC: dict[str, dict[str, tuple[float, float, float]]] = {
    "plant": {
        "size": (0, 1, 0.5), "growthRate": (0, 0.95, 0.5), "waterNeed": (0, 1, 0.5),
        "coldResistance": (0, 1, 0.5), "heatResistance": (0, 1, 0.5),
        "pollutionAbsorption": (0, 0.95, 0.2), "energyStorage": (0, 0.9, 0.3),
        "nightLuminosity": (0, 1, 0.0), "nutrition": (0, 1, 0.5),
        "toxicity": (0, 1, 0.0), "spreadRate": (0, 0.9, 0.4),
    },
    "creature": {
        "size": (0, 1, 0.4), "reproductionRate": (0, 0.9, 0.4),
        "intelligence": (0, 1, 0.3), "aggression": (0, 1, 0.4), "speed": (0, 1, 0.5),
        "adaptability": (0, 1, 0.5), "mutationRate": (0.005, 0.4, 0.06),
        "waterNeed": (0, 1, 0.5), "sociality": (0, 1, 0.5),
    },
    "resource": {
        "value": (0, 1, 0.5), "abundance": (0, 1, 0.5), "renewable": (0, 1, 0.0),
        "envImpact": (0, 1, 0.3),
    },
    "civilization": {
        "population": (0, 1, 0.4), "techLevel": (0, 1, 0.2), "military": (0, 1, 0.3),
        "innovation": (0, 1, 0.5), "aggression": (0, 1, 0.4),
        "expansionism": (0, 1, 0.5), "mercantilism": (0, 1, 0.5), "education": (0, 1, 0.3),
    },
    "invention": {"complexity": (0, 1, 0.5), "impact": (0, 1, 0.5)},
    "natural_phenomenon": {
        "rainfulness": (0, 1, 0.3), "warmth": (0, 1, 0.0), "coldness": (0, 1, 0.0),
        "severity": (0, 1, 0.3),
    },
    "disease": {"severity": (0, 0.9, 0.3), "transmission": (0, 0.9, 0.4)},
    "culture": {"influence": (0, 1, 0.5)},
    "world_law": {
        "photosynthesisBoost": (0, 0.8, 0.2), "cleanAir": (0, 0.8, 0.0), "potency": (0, 0.8, 0.2),
    },
    "custom": {"benefit": (0, 1, 0.3)},
}

ENUMERATED_TRAITS: dict[str, dict[str, list[str]]] = {
    "creature": {"diet": ["herbivore", "carnivore", "omnivore"]},
}

ALL_BIOMES = [
    "ocean", "coast", "plains", "grassland", "savanna", "rainforest",
    "temperate_forest", "boreal_forest", "desert", "steppe", "tundra",
    "ice", "mountain", "volcanic", "swamp",
]


class StructuredContribution(BaseModel):
    category: str
    name: str = Field(min_length=1, max_length=140)
    description: str | None = Field(default=None, max_length=600)
    traits: dict[str, float | str] = Field(default_factory=dict)
    possibleBiomes: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    provider: str = "mock"
    sandbox: bool = True

    @field_validator("category")
    @classmethod
    def _category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"unknown category: {v}")
        return v

    @field_validator("possibleBiomes")
    @classmethod
    def _biomes(cls, v: list[str]) -> list[str]:
        return [b for b in v if b in ALL_BIOMES]

    def normalized_traits(self) -> dict[str, float | str]:
        """Clamp numeric traits into spec bounds, fill defaults, drop unknowns."""
        spec = CATEGORY_TRAIT_SPEC[self.category]
        out: dict[str, float | str] = {}
        for name, (lo, hi, default) in spec.items():
            raw = self.traits.get(name)
            if raw is None:
                out[name] = default
                continue
            try:
                out[name] = round(min(hi, max(lo, float(raw))), 3)
            except (TypeError, ValueError):
                out[name] = default
        for trait, allowed in ENUMERATED_TRAITS.get(self.category, {}).items():
            raw = str(self.traits.get(trait, allowed[0]))
            out[trait] = raw if raw in allowed else allowed[0]
        return out


class ModerationVerdict(BaseModel):
    status: Literal["allow", "flag", "block"]
    reasons: list[str] = Field(default_factory=list)


class BalanceReport(BaseModel):
    verdict: Literal["ok", "adjusted", "rejected"]
    issues: list[dict[str, Any]] = Field(default_factory=list)
    suggested: StructuredContribution | None = None
    provider: str = "rules"
    sandbox: bool = True


class CausalNode(BaseModel):
    id: str
    kind: Literal["contribution", "primary", "secondary", "longterm", "event"]
    label: str
    horizon: str
    strength: float = 0.5
    mechanism: str | None = None


class CausalEdge(BaseModel):
    source: str
    target: str
    sign: Literal["+", "-"]
    mechanism: str


class CausalGraph(BaseModel):
    nodes: list[CausalNode]
    edges: list[CausalEdge]
    note: str = "prior_graph_computed_effects_come_from_engine"


class NarrativeResponse(BaseModel):
    text: str
    referencedEventIds: list[str]
    provider: str
    sandbox: bool
    validated: bool
