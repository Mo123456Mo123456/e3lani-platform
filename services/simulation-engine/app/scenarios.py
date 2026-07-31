"""Monte-Carlo future scenarios ("What happens after your addition?").

Forks the world N times per horizon with independent random streams,
advances each fork, and aggregates outcome distributions. Results are
explicitly probabilistic: most-likely / best / worst + uncertainty +
the factors that drove divergence. Coarser ticks for long horizons
keep runtimes bounded.
"""
from __future__ import annotations

import math
from typing import Any

from . import biomes as B
from .common import alive_civs, avg_pollution, world_population
from .engine import advance, fork_state
from .events import (
    CIVILIZATION_COLLAPSED,
    CIVILIZATION_FOUNDED,
    SPECIES_EXTINCT,
    WAR_STARTED,
    descendant_ids,
)
from .inject import inject_contribution
from .rng import derive_seed

HORIZON_TICK_DAYS = {1: 1, 10: 1, 100: 5, 1000: 25}
DEFAULT_HORIZONS = [1, 10, 100, 1000]


def run_scenarios(
    state: dict[str, Any],
    contribution: dict[str, Any] | None = None,
    horizons: list[int] | None = None,
    runs: int = 8,
) -> dict[str, Any]:
    horizons = horizons or DEFAULT_HORIZONS
    runs = max(2, min(int(runs), 16))

    base = fork_state(state)
    contribution_id = None
    root_event_ids: list[str] = []
    if contribution is not None:
        result = inject_contribution(base, contribution)
        contribution_id = result["contributionId"]
        root_event_ids = [e["id"] for e in result["events"]]

    out_horizons = []
    for years in horizons:
        out_horizons.append(
            _run_horizon(base, years, runs, contribution_id, root_event_ids))
    return {
        "baseTick": state["meta"]["tick"],
        "runs": runs,
        "contributionId": contribution_id,
        "horizons": out_horizons,
        "probabilistic": True,
    }


def _run_horizon(
    base: dict[str, Any],
    years: int,
    runs: int,
    contribution_id: str | None,
    root_event_ids: list[str],
) -> dict[str, Any]:
    ypt = HORIZON_TICK_DAYS.get(years, 10)
    ticks = max(1, years // ypt)
    samples: list[dict[str, Any]] = []
    for run in range(runs):
        fork = fork_state(base)
        fork["meta"]["yearsPerTick"] = ypt
        fork["meta"]["seed"] = derive_seed(base["meta"]["seed"], "scenario", years, run)
        events_before = len(fork["events"])
        advance(fork, ticks)
        new_events = fork["events"][events_before:]
        samples.append(_sample_metrics(fork, new_events, contribution_id, root_event_ids))
    return _aggregate(years, ticks, ypt, samples)


def _sample_metrics(
    state: dict[str, Any],
    new_events: list[dict[str, Any]],
    contribution_id: str | None,
    root_event_ids: list[str],
) -> dict[str, Any]:
    pop = world_population(state)
    civs_alive = sum(1 for _ in alive_civs(state))
    species_alive = sum(1 for s in state["species"].values() if not s["extinct"])
    plants_alive = sum(1 for p in state["plants"].values() if not p["extinct"])
    wars = sum(1 for e in new_events if e["type"] == WAR_STARTED)
    extinctions = sum(1 for e in new_events if e["type"] == SPECIES_EXTINCT)
    collapses = sum(1 for e in new_events if e["type"] == CIVILIZATION_COLLAPSED)
    foundings = sum(1 for e in new_events if e["type"] == CIVILIZATION_FOUNDED)
    pollution = avg_pollution(state)
    temp_shift = state["meta"]["globalTempShift"]

    impact = 0
    if contribution_id and root_event_ids:
        subtree: set[str] = set()
        for rid in root_event_ids:
            subtree |= descendant_ids(state["events"], rid)
        impact = sum(
            1 for e in new_events
            if e["id"] in subtree or e.get("contributionId") == contribution_id
        )

    habitability = (
        0.35 * min(1.0, pop / 30000.0)
        + 0.2 * min(1.0, civs_alive / 12.0)
        + 0.2 * min(1.0, species_alive / 250.0)
        + 0.15 * max(0.0, 1.0 - pollution * 2.0)
        + 0.1 * max(0.0, 1.0 - abs(temp_shift) / 6.0)
    )
    return {
        "population": pop,
        "civsAlive": civs_alive,
        "speciesAlive": species_alive,
        "plantsAlive": plants_alive,
        "warsStarted": wars,
        "extinctions": extinctions,
        "collapses": collapses,
        "foundings": foundings,
        "pollution": round(pollution, 4),
        "tempShift": round(temp_shift, 3),
        "contributionEvents": impact,
        "habitability": round(habitability, 4),
    }


def _aggregate(years: int, ticks: int, ypt: int, samples: list[dict[str, Any]]) -> dict[str, Any]:
    samples.sort(key=lambda s: s["habitability"])
    n = len(samples)
    median = samples[n // 2]
    best = samples[-1]
    worst = samples[0]

    def mean(key: str) -> float:
        return sum(s[key] for s in samples) / n

    def stdev(key: str) -> float:
        m = mean(key)
        return math.sqrt(sum((s[key] - m) ** 2 for s in samples) / n)

    uncertainty = 0.0
    for key in ("habitability", "population", "warsStarted"):
        m = abs(mean(key))
        uncertainty += (stdev(key) / m) if m > 1e-9 else stdev(key)
    uncertainty = min(1.0, uncertainty / 3.0)

    drivers: list[dict[str, Any]] = []
    war_heavy = [s for s in samples if s["warsStarted"] > 0]
    if war_heavy:
        avg_hab_war = sum(s["habitability"] for s in war_heavy) / len(war_heavy)
        avg_hab_peace = (
            sum(s["habitability"] for s in samples if s["warsStarted"] == 0)
            / max(1, n - len(war_heavy))
        )
        drivers.append({
            "factor": "war_outbreaks",
            "runsAffected": len(war_heavy),
            "habitabilityDelta": round(avg_hab_war - avg_hab_peace, 3),
        })
    if any(s["extinctions"] > 0 for s in samples):
        drivers.append({
            "factor": "extinction_events",
            "runsAffected": sum(1 for s in samples if s["extinctions"] > 0),
            "habitabilityDelta": None,
        })
    drivers.append({
        "factor": "climate_drift",
        "runsAffected": n,
        "habitabilityDelta": round(mean("tempShift"), 3),
    })

    return {
        "years": years,
        "ticksSimulated": ticks,
        "yearsPerTick": ypt,
        "mostLikely": median,
        "best": best,
        "worst": worst,
        "mean": {
            "population": round(mean("population"), 1),
            "civsAlive": round(mean("civsAlive"), 2),
            "warsStarted": round(mean("warsStarted"), 2),
            "extinctions": round(mean("extinctions"), 2),
            "habitability": round(mean("habitability"), 3),
            "contributionEvents": round(mean("contributionEvents"), 2),
        },
        "uncertainty": round(uncertainty, 3),
        "drivers": drivers,
    }
