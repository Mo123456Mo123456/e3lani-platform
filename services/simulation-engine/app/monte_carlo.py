from __future__ import annotations

import statistics
from typing import Any

from .config import DEFAULT_MONTE_CARLO_RUNS
from .models import PlanetState
from .rng import SeededRNG


def forecast(
    state: PlanetState,
    contribution_id: str | None = None,
    horizons: list[int] | None = None,
    runs: int = DEFAULT_MONTE_CARLO_RUNS,
) -> dict[str, Any]:
    horizons = sorted(set(horizons or [1, 10, 100, 1000]))
    base = aggregate_state(state)
    contribution_effects = {}
    if contribution_id:
        contribution = state.contributions.get(contribution_id)
        if contribution:
            contribution_effects = contribution.effects

    rng = SeededRNG(state.seed, f"forecast:{state.tick}:{contribution_id or 'baseline'}")
    scenarios: dict[int, list[dict[str, float]]] = {h: [] for h in horizons}
    for run in range(runs):
        local = dict(base)
        apply_aggregate_contribution(local, contribution_effects)
        climate_sensitivity = 0.85 + rng.stream(f"run-{run}").uniform(0.0, 0.34)
        social_sensitivity = 0.82 + rng.stream(f"social-{run}").uniform(0.0, 0.40)
        ecological_sensitivity = 0.84 + rng.stream(f"eco-{run}").uniform(0.0, 0.38)
        current_year = 0
        for horizon in horizons:
            for _ in range(horizon - current_year):
                step_aggregate(local, climate_sensitivity, social_sensitivity, ecological_sensitivity)
            current_year = horizon
            scenarios[horizon].append({k: round(v, 6) for k, v in local.items()})

    return {
        "planet_id": state.planet_id,
        "tick": state.tick,
        "contribution_id": contribution_id,
        "runs": runs,
        "horizons": {
            str(h): summarize_scenarios(scenarios[h])
            for h in horizons
        },
    }


def aggregate_state(state: PlanetState) -> dict[str, float]:
    region_count = max(1, len(state.regions))
    civ_count = max(1, len(state.civilizations))
    species_count = max(1, len(state.species))
    return {
        "mean_temperature": sum(r.temperature for r in state.regions.values()) / region_count,
        "mean_moisture": sum(r.moisture for r in state.regions.values()) / region_count,
        "mean_pollution": sum(r.pollution for r in state.regions.values()) / region_count,
        "mean_fertility": sum(r.fertility for r in state.regions.values()) / region_count,
        "total_population": sum(c.population for c in state.civilizations.values()),
        "mean_technology": sum(c.technology for c in state.civilizations.values()) / civ_count,
        "mean_stability": sum(c.stability for c in state.civilizations.values()) / civ_count,
        "biodiversity": sum(1.0 for sp in state.species.values() if sp.population > 0) / species_count,
        "biomass": sum(sp.biomass for sp in state.species.values()),
        "war_risk": min(1.0, state.metrics.get("active_wars", 0.0) / civ_count + 0.08),
        "trade_volume": state.metrics.get("trade_volume", 0.0),
    }


def apply_aggregate_contribution(local: dict[str, float], effects: dict[str, float]) -> None:
    if not effects:
        return
    local["mean_fertility"] = clamp01(local["mean_fertility"] + effects.get("fertility", 0.0) * 0.02)
    local["mean_moisture"] = clamp01(local["mean_moisture"] + effects.get("moisture", 0.0) * 0.02)
    local["mean_pollution"] = clamp01(local["mean_pollution"] + effects.get("pollution", 0.0) * 0.02)
    local["mean_technology"] = clamp01(local["mean_technology"] + effects.get("technology", 0.0) * 0.35)
    local["total_population"] = max(0.0, local["total_population"] + effects.get("population", 0.0))
    local["trade_volume"] = max(0.0, local["trade_volume"] + effects.get("economy", 0.0) * 400.0)
    local["biodiversity"] = clamp01(local["biodiversity"] + effects.get("biodiversity", 0.0) * 0.1)


def step_aggregate(local: dict[str, float], climate_sensitivity: float, social_sensitivity: float, eco: float) -> None:
    pollution_growth = (
        local["mean_technology"] * 0.00028
        + local["total_population"] / 1_000_000_000.0
        - local["mean_fertility"] * 0.00018
    ) * climate_sensitivity
    local["mean_pollution"] = clamp01(local["mean_pollution"] + pollution_growth)
    local["mean_temperature"] = clamp01(
        local["mean_temperature"] + (local["mean_pollution"] * 0.0009 - local["mean_moisture"] * 0.00018) * climate_sensitivity
    )
    local["mean_moisture"] = clamp01(
        local["mean_moisture"] + (local["mean_fertility"] * 0.00022 - local["mean_temperature"] * 0.00018)
    )
    local["mean_fertility"] = clamp01(
        local["mean_fertility"] + (local["mean_moisture"] * 0.00035 - local["mean_pollution"] * 0.00055) * eco
    )
    population_growth = (
        0.006
        + local["mean_fertility"] * 0.002
        + local["mean_technology"] * 0.001
        - local["war_risk"] * 0.003
        - local["mean_pollution"] * 0.002
    )
    local["total_population"] = max(0.0, local["total_population"] * (1.0 + population_growth * social_sensitivity))
    local["mean_technology"] = clamp01(local["mean_technology"] + local["trade_volume"] / 5_000_000.0 + 0.00035)
    local["mean_stability"] = clamp01(
        local["mean_stability"] + local["trade_volume"] / 7_500_000.0 - local["war_risk"] * 0.0012 - local["mean_pollution"] * 0.0008
    )
    local["war_risk"] = clamp01(
        local["war_risk"] * 0.985
        + (1.0 - local["mean_stability"]) * 0.002
        + max(0.0, 0.45 - local["mean_fertility"]) * 0.001
    )
    local["biodiversity"] = clamp01(
        local["biodiversity"] + (local["mean_fertility"] * 0.00045 - local["mean_pollution"] * 0.0007 - local["war_risk"] * 0.00025) * eco
    )
    local["biomass"] = max(0.0, local["biomass"] * (1.0 + (local["mean_fertility"] - local["mean_pollution"]) * 0.0012 * eco))
    local["trade_volume"] = max(0.0, local["trade_volume"] * (1.0 + local["mean_technology"] * 0.001 - local["war_risk"] * 0.002))


def summarize_scenarios(scenarios: list[dict[str, float]]) -> dict[str, Any]:
    keys = scenarios[0].keys()
    summary: dict[str, Any] = {}
    for key in keys:
        values = sorted(s[key] for s in scenarios)
        summary[key] = {
            "p10": round(percentile(values, 0.10), 6),
            "p50": round(statistics.median(values), 6),
            "p90": round(percentile(values, 0.90), 6),
        }
    return summary


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    idx = p * (len(values) - 1)
    lo = int(idx)
    hi = min(lo + 1, len(values) - 1)
    frac = idx - lo
    return values[lo] * (1.0 - frac) + values[hi] * frac


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))

