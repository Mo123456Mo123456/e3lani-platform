"""Scientific Monte Carlo projection.

A compact causal system model used for heavy batch analysis ("what happens
in 1000 years?"). Each branch forks its RNG from the world seed, so the full
ensemble is reproducible. Dynamics:

  vegetation    logistic growth, bounded by water & climate stress
  pollution     emissions − vegetation absorption − natural decay
  climate       relaxes toward a forcing-driven equilibrium
  stability     mean-reverting random walk pushed by scarcity & wars
  wars          hazard grows with pollution-driven scarcity & instability
  contribution  survives when its habitat & resource needs stay satisfied

The model is deliberately simple — but every state transition traces back to
a driver, which is what makes the decisive-factor analysis meaningful.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .models import BranchOutcome, ContributionTraits, ScenarioReport, WorldSummaryInput
from .rng import rng_from_string


@dataclass
class BranchState:
    vegetation: float
    pollution: float
    climate: float
    stability: float
    population: float
    wars: int
    contribution_pop: float
    events: List[str] = field(default_factory=list)


def _clamp01(v: float) -> float:
    return 0.0 if v < 0 else 1.0 if v > 1 else v


def run_branch(
    world: WorldSummaryInput,
    contribution: Optional[ContributionTraits],
    run_index: int,
    horizon: int,
) -> BranchOutcome:
    rng = rng_from_string(f"{world.seed}%mc{run_index}")
    traits = contribution.traits if contribution else {}
    water_need = traits.get("waterNeed", 0.4)
    absorption = traits.get("pollutionAbsorption", 0.0)
    growth_rate = traits.get("growthRate", traits.get("reproductionRate", 0.3))
    toxicity = traits.get("toxicity", 0.0)

    state = BranchState(
        vegetation=world.vegetation,
        pollution=world.pollution,
        climate=world.climate,
        stability=world.stability,
        population=world.mean_population,
        wars=world.active_wars,
        contribution_pop=0.3 if contribution else 0.0,
    )

    for tick in range(horizon):
        # --- climate relaxes toward forcing equilibrium ----------------------
        forcing = 0.5 + state.pollution * 0.3
        state.climate = _clamp01(state.climate + (forcing - state.climate) * 0.02)

        # --- vegetation: logistic growth limited by heat & water stress -----
        heat_stress = max(0.0, state.climate - 0.65)
        water_factor = 1.0 - max(0.0, water_need - (1.0 - heat_stress)) * 0.5
        growth = 0.03 * state.vegetation * (1 - state.vegetation) * water_factor
        state.vegetation = _clamp01(state.vegetation + growth - heat_stress * 0.01)

        # --- pollution: emissions vs absorption & decay ----------------------
        emissions = 0.002 * (1 + (state.population / 2000)) * (1 + state.wars * 0.5)
        absorbed = state.vegetation * (0.002 + absorption * 0.01)
        state.pollution = _clamp01(state.pollution + emissions - absorbed - state.pollution * 0.01)

        # --- contribution population: thrives or dies by its own needs -------
        if contribution:
            stress = heat_stress * (1 - traits.get("heatResistance", 0.4))
            stress += max(0.0, water_need - (1 - heat_stress)) * 0.4
            support = state.vegetation * 0.6 + (1 - state.pollution) * 0.4
            delta = growth_rate * 0.05 * state.contribution_pop * (support - stress - 0.3)
            state.contribution_pop = _clamp01(state.contribution_pop + delta)
            if state.contribution_pop <= 0.01:
                state.events.append(f"contribution_collapsed@{tick}")
            if toxicity > 0.4 and rng.chance(toxicity * 0.01):
                state.vegetation = _clamp01(state.vegetation - toxicity * 0.05)
                state.events.append(f"toxic_dieback@{tick}")

        # --- stability & wars --------------------------------------------------
        scarcity = max(0.0, state.pollution - 0.4) + max(0.0, 0.3 - state.vegetation)
        mean_reversion = (0.55 - state.stability) * 0.02
        shock = rng.range(-0.02, 0.02) - scarcity * 0.01
        state.stability = _clamp01(state.stability + mean_reversion + shock)

        war_hazard = 0.004 + scarcity * 0.02 + max(0.0, 0.4 - state.stability) * 0.02
        if rng.chance(war_hazard):
            state.wars += 1
            state.events.append(f"war_outbreak@{tick}")
            state.population *= 0.98
        if state.wars > 0 and rng.chance(0.05 + state.stability * 0.05):
            state.wars -= 1
            state.events.append(f"peace_treaty@{tick}")

        if state.pollution > 0.75 and rng.chance(0.03):
            state.events.append(f"pollution_crisis@{tick}")
        if heat_stress > 0.2 and rng.chance(0.02):
            state.population *= 0.99
            state.events.append(f"heat_dieoff@{tick}")

    survives = state.contribution_pop > 0.08 if contribution else True
    score = (
        (state.contribution_pop if contribution else 0.5) * 0.4
        + state.stability * 0.3
        + (1 - state.pollution) * 0.2
        + min(1.0, state.vegetation) * 0.1
    )
    return BranchOutcome(
        run_index=run_index,
        score=round(score, 4),
        contribution_survives=survives,
        end_state={
            "stability": round(state.stability, 4),
            "pollution": round(state.pollution, 4),
            "vegetation": round(state.vegetation, 4),
            "climate": round(state.climate, 4),
            "wars": float(state.wars),
            "contribution_pop": round(state.contribution_pop, 4),
        },
        notable_events=state.events[:12],
    )


def run_scenarios(
    world: WorldSummaryInput,
    contribution: Optional[ContributionTraits],
    horizon: int,
    runs: int,
) -> ScenarioReport:
    outcomes = [run_branch(world, contribution, i, horizon) for i in range(runs)]
    ranked = sorted(outcomes, key=lambda o: o.score)
    mean = sum(o.score for o in outcomes) / len(outcomes)
    variance = sum((o.score - mean) ** 2 for o in outcomes) / len(outcomes)
    event_diversity = len({tuple(sorted(o.notable_events)) for o in outcomes}) / len(outcomes)
    uncertainty = min(1.0, (variance ** 0.5) * 2 + event_diversity * 0.5)

    return ScenarioReport(
        most_likely=ranked[len(ranked) // 2],
        best=ranked[-1],
        worst=ranked[0],
        uncertainty=round(uncertainty, 4),
        decisive_factors=_decisive_factors(outcomes),
        runs=runs,
        horizon_ticks=horizon,
    )


def _decisive_factors(outcomes: List[BranchOutcome]) -> List[str]:
    ranked = sorted(outcomes, key=lambda o: o.score)
    q = max(1, len(ranked) // 4)
    top, bottom = ranked[-q:], ranked[:q]

    def freq(runs: List[BranchOutcome], prefix: str) -> float:
        return sum(1 for r in runs if any(e.startswith(prefix) for e in r.notable_events)) / len(runs)

    candidates = ["war_outbreak", "pollution_crisis", "heat_dieoff", "toxic_dieback", "contribution_collapsed", "peace_treaty"]
    scored = sorted(candidates, key=lambda c: abs(freq(top, c) - freq(bottom, c)), reverse=True)
    return [c for c in scored if abs(freq(top, c) - freq(bottom, c)) > 0.01][:4] or ["climate_drift"]
