"""Planet world generation from a deterministic seed."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from .noise import simplex_like
from .rng import SeededRNG

BIOMES = (
    "ocean",
    "coast",
    "plains",
    "forest",
    "desert",
    "tundra",
    "mountain",
    "swamp",
)


@dataclass
class PlanetWorld:
    planet_id: str
    seed: int
    width: int
    height: int
    elevation: np.ndarray
    temperature: np.ndarray
    moisture: np.ndarray
    pollution: np.ndarray
    biomes: list[list[str]]
    species: dict[str, float] = field(default_factory=dict)
    civs: list[dict[str, Any]] = field(default_factory=list)
    markets: dict[str, dict[str, float]] = field(default_factory=dict)
    tick: int = 0
    injected: list[dict[str, Any]] = field(default_factory=list)

    def summary(self) -> dict[str, Any]:
        biome_counts: dict[str, int] = {}
        for row in self.biomes:
            for b in row:
                biome_counts[b] = biome_counts.get(b, 0) + 1
        return {
            "planet_id": self.planet_id,
            "seed": self.seed,
            "width": self.width,
            "height": self.height,
            "tick": self.tick,
            "biome_counts": biome_counts,
            "mean_temperature": float(np.mean(self.temperature)),
            "mean_moisture": float(np.mean(self.moisture)),
            "mean_pollution": float(np.mean(self.pollution)),
            "species": dict(self.species),
            "civ_count": len(self.civs),
            "injected_count": len(self.injected),
        }

    def snapshot(self) -> dict[str, Any]:
        return {
            "planet_id": self.planet_id,
            "seed": self.seed,
            "width": self.width,
            "height": self.height,
            "tick": self.tick,
            "elevation": self.elevation.tolist(),
            "temperature": self.temperature.tolist(),
            "moisture": self.moisture.tolist(),
            "pollution": self.pollution.tolist(),
            "biomes": self.biomes,
            "species": dict(self.species),
            "civs": [dict(c) for c in self.civs],
            "markets": {k: dict(v) for k, v in self.markets.items()},
            "injected": [dict(i) for i in self.injected],
        }

    @classmethod
    def from_snapshot(cls, data: dict[str, Any]) -> "PlanetWorld":
        return cls(
            planet_id=data["planet_id"],
            seed=int(data["seed"]),
            width=int(data["width"]),
            height=int(data["height"]),
            elevation=np.array(data["elevation"], dtype=np.float64),
            temperature=np.array(data["temperature"], dtype=np.float64),
            moisture=np.array(data["moisture"], dtype=np.float64),
            pollution=np.array(data["pollution"], dtype=np.float64),
            biomes=data["biomes"],
            species=dict(data.get("species") or {}),
            civs=[dict(c) for c in data.get("civs") or []],
            markets={k: dict(v) for k, v in (data.get("markets") or {}).items()},
            tick=int(data.get("tick") or 0),
            injected=[dict(i) for i in data.get("injected") or []],
        )


def _classify_biome(elev: float, temp: float, moist: float) -> str:
    if elev < -0.15:
        return "ocean"
    if elev < -0.05:
        return "coast"
    if elev > 0.55:
        return "mountain"
    if temp < -0.25:
        return "tundra"
    if moist < -0.2 and temp > 0.15:
        return "desert"
    if moist > 0.35 and temp > 0.0:
        return "swamp"
    if moist > 0.1:
        return "forest"
    return "plains"


def generate_world(
    planet_id: str,
    seed: int,
    width: int = 32,
    height: int = 32,
) -> PlanetWorld:
    """Build elevation/climate grids and seed baseline ecology & civs."""
    rng = SeededRNG(seed)
    elev_rng = rng.derive("elevation")
    temp_rng = rng.derive("temperature")
    moist_rng = rng.derive("moisture")

    elevation = simplex_like(elev_rng, width, height, scale=0.07)
    temperature = simplex_like(temp_rng, width, height, scale=0.05)
    # Latitude bias: cooler toward poles
    for y in range(height):
        lat = abs((y / max(height - 1, 1)) * 2.0 - 1.0)
        temperature[y, :] -= 0.45 * lat
    moisture = simplex_like(moist_rng, width, height, scale=0.06)
    pollution = np.zeros((height, width), dtype=np.float64)

    biomes: list[list[str]] = []
    for y in range(height):
        row: list[str] = []
        for x in range(width):
            row.append(_classify_biome(float(elevation[y, x]), float(temperature[y, x]), float(moisture[y, x])))
        biomes.append(row)

    # Baseline species pools (Lotka–Volterra style)
    species = {
        "producers": 80.0 + rng.uniform(0, 20),
        "herbivores": 30.0 + rng.uniform(0, 10),
        "carnivores": 8.0 + rng.uniform(0, 4),
        "decomposers": 40.0 + rng.uniform(0, 10),
    }

    civs: list[dict[str, Any]] = []
    n_civs = rng.randint(2, 4)
    for i in range(n_civs):
        cx = rng.randint(0, width - 1)
        cy = rng.randint(0, height - 1)
        civs.append(
            {
                "id": f"civ-{i}",
                "name": f"Civ-{i}",
                "x": cx,
                "y": cy,
                "population": 100.0 + rng.uniform(0, 50),
                "aggression": rng.uniform(0.1, 0.7),
                "tech": rng.uniform(0.1, 0.5),
                "wealth": 50.0 + rng.uniform(0, 30),
                "utility_food": rng.uniform(0.3, 0.8),
                "utility_security": rng.uniform(0.2, 0.7),
                "utility_growth": rng.uniform(0.2, 0.8),
            }
        )

    markets = {
        "food": {"supply": 100.0, "demand": 90.0, "price": 1.0},
        "energy": {"supply": 80.0, "demand": 70.0, "price": 1.2},
        "materials": {"supply": 60.0, "demand": 55.0, "price": 1.5},
    }

    return PlanetWorld(
        planet_id=planet_id,
        seed=seed,
        width=width,
        height=height,
        elevation=elevation,
        temperature=temperature,
        moisture=moisture,
        pollution=pollution,
        biomes=biomes,
        species=species,
        civs=civs,
        markets=markets,
        tick=0,
    )
