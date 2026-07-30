"""Shared helpers for simulation systems."""
from __future__ import annotations

from typing import Any, Iterator

from . import biomes as B
from .grid import Grid


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if v < lo else hi if v > hi else v


def prob_dt(p: float, dt: float) -> float:
    """Scale a per-year probability to a ``dt``-year tick."""
    if p <= 0:
        return 0.0
    if p >= 1:
        return 1.0
    return 1.0 - (1.0 - p) ** dt


def grid_of(state: dict[str, Any]) -> Grid:
    return Grid(state["grid"]["latBands"], state["grid"]["lonBands"])


def eff_temp(state: dict[str, Any], cell: dict[str, Any]) -> float:
    return cell["temp"] + state["meta"].get("globalTempShift", 0.0)


def alive_civs(state: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for cid in sorted(state["civilizations"]):
        civ = state["civilizations"][cid]
        if not civ["extinct"]:
            yield civ


def territory_of(state: dict[str, Any], civ_id: str) -> list[int]:
    return [c["id"] for c in state["cells"] if c["owner"] == civ_id]


def border_index(state: dict[str, Any]) -> dict[tuple[str, str], list[int]]:
    """One-pass index of adjacent civ pairs and their frontier cells."""
    grid = grid_of(state)
    cells = state["cells"]
    out: dict[tuple[str, str], list[int]] = {}
    for cell in cells:
        if not cell["owner"]:
            continue
        for nb in grid.neighbors(cell["id"], diagonal=True):
            other = cells[nb]["owner"]
            if other and other != cell["owner"]:
                pair = (min(cell["owner"], other), max(cell["owner"], other))
                fronts = out.setdefault(pair, [])
                if cell["id"] not in fronts:
                    fronts.append(cell["id"])
    return out


def civ_capacity(state: dict[str, Any], civ: dict[str, Any]) -> float:
    total = 0.0
    bonus = 1.0 + 0.12 * max(0, civ["techLevel"] - 1)
    for cell in state["cells"]:
        if cell["owner"] == civ["id"]:
            total += B.CIV_CAPACITY.get(cell["biome"], 1000) * (1.2 if cell["freshwater"] else 1.0)
    return total * bonus


def civ_bonuses(state: dict[str, Any], civ: dict[str, Any]) -> dict[str, float]:
    """Aggregate bonuses from discovered technologies (by tier)."""
    tiers = [
        t["tier"] for t in state["technologies"].values() if t["discoveredBy"] == civ["id"]
    ]
    max_tier = max(tiers, default=0)
    return {
        "farm": 1.0 + 0.25 * sum(1 for t in tiers if t >= 1),
        "military": 1.0 + 0.20 * sum(1 for t in tiers if t >= 2),
        "medicine": 1.0 + 0.30 * sum(1 for t in tiers if t >= 3),
        "capacity": 1.0 + 0.15 * sum(1 for t in tiers if t >= 3),
        "navigation": 1.0 + 0.25 * sum(1 for t in tiers if t >= 2),
        "industry": 1.0 + 0.30 * sum(1 for t in tiers if t >= 4),
        "maxTier": float(max_tier),
    }


def total_species_population(species: dict[str, Any]) -> float:
    return sum(species["populations"].values())


def world_population(state: dict[str, Any]) -> float:
    return sum(c["population"] for c in alive_civs(state))


def avg_pollution(state: dict[str, Any]) -> float:
    land = [c for c in state["cells"] if B.is_land(c["biome"])]
    if not land:
        return 0.0
    return sum(c["pollution"] for c in land) / len(land)


def relationship(state: dict[str, Any], a: str, b: str) -> dict[str, Any]:
    civ = state["civilizations"][a]
    rel = civ["relationships"].get(b)
    if rel is None:
        rel = {"trust": 0.1, "grievances": 0, "atWar": False, "allied": False, "trade": False}
        civ["relationships"][b] = rel
    return rel
