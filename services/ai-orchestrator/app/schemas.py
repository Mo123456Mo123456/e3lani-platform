"""Pydantic contracts — mirrors of packages/shared-types contribution types.

Every provider's output is validated through these models; invalid LLM
output never reaches the simulation engine.
"""
from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Category(str, Enum):
    creature = "creature"
    plant = "plant"
    resource = "resource"
    civilization = "civilization"
    invention = "invention"
    phenomenon = "phenomenon"
    disease = "disease"
    culture = "culture"
    law = "law"
    custom = "custom"


class Biome(str, Enum):
    ocean = "ocean"
    coast = "coast"
    plains = "plains"
    rainforest = "rainforest"
    temperate_forest = "temperate_forest"
    desert = "desert"
    mountains = "mountains"
    tundra = "tundra"
    swamp = "swamp"
    steppe = "steppe"
    volcanic = "volcanic"
    ice = "ice"


class StructuredContribution(BaseModel):
    category: Category
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=600)
    traits: Dict[str, float] = Field(default_factory=dict)
    possible_biomes: List[Biome] = Field(default_factory=list, max_length=6)
    risks: List[str] = Field(default_factory=list, max_length=8)

    def normalized_traits(self) -> Dict[str, float]:
        return {k: max(0.0, min(1.0, v)) for k, v in self.traits.items()}


class ParseRequest(BaseModel):
    text: str = Field(min_length=4, max_length=2000)
    category: Optional[Category] = None
    locale: str = Field(default="ar", pattern="^(ar|en)$")
    user_id: Optional[str] = None


class BalanceViolation(BaseModel):
    code: str
    message: str
    severity: str = "nerf"


class BalanceReport(BaseModel):
    balanced: bool
    violations: List[BalanceViolation]
    suggested: Optional[StructuredContribution]
    power_score: float


class ParseResponse(BaseModel):
    structured: StructuredContribution
    balance: BalanceReport
    provider: str
    sandbox: bool


class NarrateRequest(BaseModel):
    contribution_name: str
    locale: str = Field(default="ar", pattern="^(ar|en)$")
    # the ONLY facts the narrator may use — produced by the causal allowlist
    facts: List[str] = Field(default_factory=list, max_length=200)


class NarrateResponse(BaseModel):
    text: str
    provider: str


# JSON Schema exposed to LLM providers for structured output enforcement
CONTRIBUTION_JSON_SCHEMA: dict = StructuredContribution.model_json_schema()
