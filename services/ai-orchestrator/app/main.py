from __future__ import annotations

import re
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .providers import ProviderError, get_provider


Biome = Literal[
    "ocean", "coast", "plains", "tropical_forest", "temperate_forest", "desert",
    "mountain", "tundra", "wetland", "steppe", "volcanic", "ice",
]
Category = Literal[
    "creature", "plant", "resource", "civilization", "invention",
    "natural_phenomenon", "disease", "culture", "world_law", "custom",
]


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Category
    idea: str = Field(min_length=12, max_length=2000)
    locale: Literal["ar", "en"] = "ar"

    @field_validator("idea")
    @classmethod
    def reject_injection(cls, value: str) -> str:
        blocked = (
            r"ignore\b.{0,40}\b(all|previous|system)\b.{0,30}\binstructions",
            r"<\s*script",
            r"\b(drop|truncate)\s+table\b",
            r"\b(exec|spawn|system)\s*\(",
        )
        if any(re.search(pattern, value, re.IGNORECASE) for pattern in blocked):
            raise ValueError("Input contains a blocked instruction pattern")
        return value.strip()


class BalanceResult(BaseModel):
    score: float = Field(ge=0, le=1)
    adjusted: bool
    adjustments: list[str] = Field(max_length=16)


class AnalysisResponse(BaseModel):
    category: Category
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    traits: dict[str, float]
    possibleBiomes: list[Biome] = Field(min_length=1, max_length=12)
    risks: list[str] = Field(max_length=16)
    balance: BalanceResult
    provider: str
    sandbox: bool

    @field_validator("traits")
    @classmethod
    def validate_traits(cls, value: dict[str, float]) -> dict[str, float]:
        if len(value) > 32:
            raise ValueError("Too many traits")
        if any(not 0 <= trait <= 1 for trait in value.values()):
            raise ValueError("Trait values must be normalized")
        return value

    @field_validator("risks")
    @classmethod
    def validate_risks(cls, value: list[str]) -> list[str]:
        if any(not re.fullmatch(r"[a-z0-9_]+", risk) for risk in value):
            raise ValueError("Risk codes must use snake_case")
        return value


class GroundedEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str
    summary: str
    year: int
    cause: str
    directEffects: dict[str, float]


class NarrateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    locale: Literal["ar", "en"] = "ar"
    events: list[GroundedEvent] = Field(min_length=1, max_length=25)


class NarrateResponse(BaseModel):
    narrative: str
    sourceEventIds: list[str]
    provider: str
    sandbox: bool


def balance(raw: dict, idea: str) -> tuple[dict, BalanceResult]:
    traits = {str(key): max(0.0, min(1.0, float(value))) for key, value in raw.get("traits", {}).items()}
    adjustments: list[str] = []
    impossible_words = (
        "immortal", "unlimited", "infinite", "destroys the planet instantly", "absolute control",
        "لا يموت", "غير محدود", "لانهائي", "يدمر الكوكب فور", "سيطرة مطلقة",
    )
    if any(word in idea.lower() for word in impossible_words):
        adjustments.append("Converted absolute or unlimited capability into a bounded high-cost trait")
    for trait_name in ("growthRate", "reproductionRate", "energyYield", "mortalityRate"):
        if traits.get(trait_name, 0) > 0.9:
            traits[trait_name] = 0.78
            adjustments.append(f"Capped {trait_name} at a sustainable value")
    power = sum(traits.values()) / max(1, len(traits))
    score = max(0.1, min(1.0, 1.0 - abs(power - 0.5) * 0.7 - len(adjustments) * 0.08))
    raw["traits"] = traits
    risks = set(str(risk) for risk in raw.get("risks", []))
    if adjustments:
        risks.add("balance_constraints_applied")
    raw["risks"] = sorted(risks)
    return raw, BalanceResult(score=round(score, 4), adjusted=bool(adjustments), adjustments=adjustments)


app = FastAPI(
    title="Living Planet AI Orchestrator",
    version="0.1.0",
    description="Provider-neutral structured analysis. Simulation outcomes are never generated here.",
)


@app.get("/health")
async def health() -> dict:
    provider = get_provider()
    return {"status": "ok", "provider": provider.name, "sandbox": provider.sandbox}


@app.post("/v1/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalyzeRequest) -> AnalysisResponse:
    provider = get_provider()
    try:
        raw = await provider.analyze(request.category, request.idea, request.locale)
        raw, balance_result = balance(raw, request.idea)
        raw["category"] = request.category
        return AnalysisResponse(
            **raw,
            balance=balance_result,
            provider=provider.name,
            sandbox=provider.sandbox,
        )
    except (ProviderError, ValueError, TypeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/v1/narrate", response_model=NarrateResponse)
async def narrate(request: NarrateRequest) -> NarrateResponse:
    """Grounded sandbox narration: every sentence is assembled from a supplied event."""
    provider = get_provider()
    if request.locale == "ar":
        sentences = [
            f"في السنة {event.year}، {event.title}: {event.summary} والسبب المسجل هو {event.cause}."
            for event in request.events
        ]
    else:
        sentences = [
            f"In year {event.year}, {event.title}: {event.summary} Recorded cause: {event.cause}."
            for event in request.events
        ]
    return NarrateResponse(
        narrative=" ".join(sentences),
        sourceEventIds=[event.id for event in request.events],
        provider=f"{provider.name}:grounded-template",
        sandbox=provider.sandbox,
    )
