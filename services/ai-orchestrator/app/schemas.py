"""Pydantic schemas for AI orchestrator structured outputs."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class StructuredElementOutput(BaseModel):
    """Canonical structured element produced by analyze-element."""

    category: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    traits: dict[str, float] = Field(default_factory=dict)
    possibleBiomes: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    narrative: str = Field(..., min_length=1)

    @field_validator("traits")
    @classmethod
    def traits_in_unit_interval(cls, v: dict[str, float]) -> dict[str, float]:
        out: dict[str, float] = {}
        for key, val in v.items():
            f = float(val)
            if f < 0.0 or f > 1.0:
                raise ValueError(f"trait '{key}' must be in [0, 1], got {f}")
            out[key] = f
        return out


class AnalyzeElementRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    language: Literal["ar", "en"] = "ar"
    provider: str | None = None


class NarrateRequest(BaseModel):
    facts: list[str] = Field(..., min_length=1)
    language: Literal["ar", "en"] = "ar"
    tick: int | None = None
    planet_id: str | None = None
    use_llm: bool = False


class ModerateRequest(BaseModel):
    text: str = Field(..., min_length=1)


class BalanceRequest(BaseModel):
    element: StructuredElementOutput


class ModerationResult(BaseModel):
    allowed: bool
    reasons: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)
    sanitized_text: str | None = None


class BalanceResult(BaseModel):
    balanced: StructuredElementOutput
    was_overpowered: bool
    adjustments: list[str] = Field(default_factory=list)
    alternatives: list[StructuredElementOutput] = Field(default_factory=list)


class NarrationResult(BaseModel):
    language: Literal["ar", "en"]
    narrative: str
    facts_used: list[str]
    invented: bool = False
    provider: str = "template"


class HealthResponse(BaseModel):
    status: str
    service: str
    provider: str
    sandbox: bool


class AnalyzeElementResponse(BaseModel):
    element: StructuredElementOutput
    moderation: ModerationResult
    balance: BalanceResult
    provider: str
    sandbox: bool
    raw: dict[str, Any] | None = None
