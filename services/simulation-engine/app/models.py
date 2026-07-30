"""Contracts for the scientific simulation service."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class WorldSummaryInput(BaseModel):
    """Compressed world state — what the API ships for heavy analysis."""
    seed: str
    tick: int = 0
    stability: float = Field(default=0.5, ge=0, le=1)
    civilizations: int = Field(default=6, ge=0)
    mean_population: float = Field(default=1000, ge=0)
    climate: float = Field(default=0.5, ge=0, le=1)
    pollution: float = Field(default=0.1, ge=0, le=1)
    vegetation: float = Field(default=0.4, ge=0, le=1)
    active_wars: int = Field(default=0, ge=0)
    habitat_suitability: float = Field(default=0.5, ge=0, le=1)


class ContributionTraits(BaseModel):
    category: str = "plant"
    traits: Dict[str, float] = Field(default_factory=dict)


class ScenarioRequest(BaseModel):
    world: WorldSummaryInput
    contribution: Optional[ContributionTraits] = None
    horizon_ticks: int = Field(default=100, ge=1, le=2000)
    runs: int = Field(default=12, ge=3, le=64)


class BranchOutcome(BaseModel):
    run_index: int
    score: float
    contribution_survives: bool
    end_state: Dict[str, float]
    notable_events: List[str]


class ScenarioReport(BaseModel):
    most_likely: BranchOutcome
    best: BranchOutcome
    worst: BranchOutcome
    uncertainty: float
    decisive_factors: List[str]
    runs: int
    horizon_ticks: int
    engine: str = "python-simulation-engine/0.1"
