"""Procedural planet generation from a single seed.

Pipeline: height field (fBm + continent mask) -> ocean/land -> BFS ocean
distance -> temperature (latitude + altitude lapse) -> moisture (noise +
ocean proximity) -> rivers (downhill flow) -> volcanoes (Worley peaks)
-> biome classification -> fertility -> resource deposits -> plants ->
species (with food web) -> civilizations with capitals.

Everything derives from ``Rng(seed, 'gen', ...)`` streams, so the same
seed always produces byte-identical worlds.
"""
from __future__ import annotations

import math
from typing import Any

from . import biomes as B
from .events import (
    CITY_CREATED,
    CIVILIZATION_FOUNDED,
    PLANT_SPREAD,
    RESOURCE_DISCOVERED,
    SPECIES_CREATED,
    TECHNOLOGY_DISCOVERED,
    WORLD_GENESIS,
    EventLog,
)
from .grid import Grid, bfs_distance
from .names import city_name, civ_name, culture_name, language_name, species_name, tech_name
from .noise import SimplexNoise, WorleyNoise
from .rng import Rng

RESOURCE_KINDS: list[dict[str, Any]] = [
    {"id": "iron", "name": "Iron Ore", "kind": "metal", "baseValue": 1.2, "regen": 0.0,
     "biomes": {B.MOUNTAIN: 3.0, B.STEPPE: 1.0, B.TUNDRA: 0.8, B.VOLCANIC: 1.5}, "envImpact": 0.5},
    {"id": "copper", "name": "Copper", "kind": "metal", "baseValue": 1.4, "regen": 0.0,
     "biomes": {B.MOUNTAIN: 2.5, B.VOLCANIC: 2.0, B.DESERT: 0.6}, "envImpact": 0.5},
    {"id": "gold", "name": "Gold", "kind": "luxury", "baseValue": 4.0, "regen": 0.0,
     "biomes": {B.MOUNTAIN: 1.2, B.VOLCANIC: 1.0}, "envImpact": 0.4},
    {"id": "coal", "name": "Coal", "kind": "energy", "baseValue": 1.0, "regen": 0.0,
     "biomes": {B.STEPPE: 1.4, B.MOUNTAIN: 1.2, B.TUNDRA: 1.0, B.BOREAL_FOREST: 0.8}, "envImpact": 0.9},
    {"id": "oil", "name": "Petroleum", "kind": "energy", "baseValue": 2.2, "regen": 0.0,
     "biomes": {B.DESERT: 2.2, B.SWAMP: 1.2, B.TUNDRA: 0.8}, "envImpact": 1.0},
    {"id": "timber", "name": "Timber", "kind": "material", "baseValue": 0.8, "regen": 0.03,
     "biomes": {B.TEMPERATE_FOREST: 3.0, B.BOREAL_FOREST: 2.4, B.RAINFOREST: 2.0}, "envImpact": 0.3},
    {"id": "fertile_soil", "name": "Fertile Soil", "kind": "food", "baseValue": 1.1, "regen": 0.02,
     "biomes": {B.PLAINS: 3.0, B.GRASSLAND: 2.4, B.SAVANNA: 1.4, B.SWAMP: 0.8}, "envImpact": 0.1},
    {"id": "fish", "name": "Fisheries", "kind": "food", "baseValue": 0.9, "regen": 0.05,
     "biomes": {B.COAST: 3.0, B.OCEAN: 1.0}, "envImpact": 0.2},
    {"id": "freshwater", "name": "Fresh Water", "kind": "water", "baseValue": 1.3, "regen": 0.06,
     "biomes": {B.SWAMP: 2.4, B.TEMPERATE_FOREST: 1.4, B.PLAINS: 1.0, B.TUNDRA: 1.0}, "envImpact": 0.1},
    {"id": "spices", "name": "Spices", "kind": "luxury", "baseValue": 2.8, "regen": 0.02,
     "biomes": {B.RAINFOREST: 2.6, B.SAVANNA: 0.8}, "envImpact": 0.2},
    {"id": "gems", "name": "Gemstones", "kind": "luxury", "baseValue": 3.5, "regen": 0.0,
     "biomes": {B.MOUNTAIN: 0.9, B.VOLCANIC: 1.4, B.DESERT: 0.5}, "envImpact": 0.4},
    {"id": "geothermal", "name": "Geothermal Vents", "kind": "energy", "baseValue": 2.0, "regen": 0.08,
     "biomes": {B.VOLCANIC: 3.0, B.MOUNTAIN: 0.7}, "envImpact": 0.1},
    {"id": "salt", "name": "Salt", "kind": "material", "baseValue": 1.0, "regen": 0.02,
     "biomes": {B.DESERT: 1.8, B.COAST: 1.6}, "envImpact": 0.1},
    {"id": "medicinal_herbs", "name": "Medicinal Herbs", "kind": "food", "baseValue": 1.6, "regen": 0.03,
     "biomes": {B.RAINFOREST: 2.0, B.TEMPERATE_FOREST: 1.4, B.SWAMP: 1.0}, "envImpact": 0.1},
]

PLANT_ARCHETYPES: dict[str, dict[str, float]] = {
    B.RAINFOREST: {"size": 0.8, "growthRate": 0.7, "waterNeed": 0.85, "coldRes": 0.15, "heatRes": 0.9},
    B.TEMPERATE_FOREST: {"size": 0.7, "growthRate": 0.5, "waterNeed": 0.6, "coldRes": 0.6, "heatRes": 0.6},
    B.BOREAL_FOREST: {"size": 0.6, "growthRate": 0.35, "waterNeed": 0.45, "coldRes": 0.9, "heatRes": 0.3},
    B.PLAINS: {"size": 0.25, "growthRate": 0.8, "waterNeed": 0.45, "coldRes": 0.5, "heatRes": 0.6},
    B.GRASSLAND: {"size": 0.3, "growthRate": 0.75, "waterNeed": 0.5, "coldRes": 0.5, "heatRes": 0.65},
    B.SAVANNA: {"size": 0.4, "growthRate": 0.6, "waterNeed": 0.35, "coldRes": 0.3, "heatRes": 0.9},
    B.DESERT: {"size": 0.2, "growthRate": 0.3, "waterNeed": 0.1, "coldRes": 0.4, "heatRes": 1.0},
    B.STEPPE: {"size": 0.25, "growthRate": 0.55, "waterNeed": 0.3, "coldRes": 0.75, "heatRes": 0.5},
    B.TUNDRA: {"size": 0.15, "growthRate": 0.3, "waterNeed": 0.35, "coldRes": 1.0, "heatRes": 0.2},
    B.SWAMP: {"size": 0.5, "growthRate": 0.65, "waterNeed": 0.95, "coldRes": 0.3, "heatRes": 0.7},
    B.MOUNTAIN: {"size": 0.3, "growthRate": 0.35, "waterNeed": 0.4, "coldRes": 0.85, "heatRes": 0.35},
}

GOVERNMENTS = ["tribal_council", "monarchy", "oligarchy", "republic", "theocracy", "chiefdom"]


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if v < lo else hi if v > hi else v


def generate_world(seed: int, params: dict[str, Any] | None = None) -> dict[str, Any]:
    p = {
        "latBands": 36,
        "lonBands": 72,
        "civilizations": 12,
        "species": 300,
        "plants": 800,
        "deposits": 120,
        "yearsPerTick": 1,
        "rivers": 90,
    }
    if params:
        p.update({k: v for k, v in params.items() if v is not None})

    grid = Grid(p["latBands"], p["lonBands"])
    events_state = {"events": [], "eventCounter": 0}
    log = EventLog(events_state)

    height_noise = SimplexNoise(seed, "height")
    continent_noise = SimplexNoise(seed, "continent")
    temp_noise = SimplexNoise(seed, "temperature")
    moist_noise = SimplexNoise(seed, "moisture")
    volcano_noise = WorleyNoise(seed, "volcano", density=3)

    # ---- height field ------------------------------------------------
    heights: list[float] = []
    scale = 3.0 / max(grid.lat_bands, 1)
    for cid in range(grid.size):
        x = grid.lon_i(cid) * scale
        y = grid.lat_i(cid) * scale * 2.0
        base = height_noise.fbm(x, y, octaves=5) * 0.5 + 0.5
        continent = continent_noise.fbm(x * 0.45, y * 0.45, octaves=3) * 0.5 + 0.5
        ridge = height_noise.ridged(x * 1.7, y * 1.7, octaves=4)
        h = base * 0.55 + continent * 0.35 + (ridge - 0.5) * 0.2
        heights.append(_clamp(h))

    is_ocean = [heights[c] < B.SEA_LEVEL for c in range(grid.size)]
    ocean_cells = [c for c in range(grid.size) if is_ocean[c]]
    land_cells = [c for c in range(grid.size) if not is_ocean[c]]
    ocean_dist = bfs_distance(grid, ocean_cells, lambda c: not is_ocean[c])
    land_dist = bfs_distance(grid, land_cells, lambda c: is_ocean[c])

    # ---- climate base ------------------------------------------------
    temps: list[float] = []
    moistures: list[float] = []
    for cid in range(grid.size):
        lat = grid.lat_deg(cid)
        base_t = 30.0 - (abs(lat) / 90.0) * 62.0  # +30 equator .. -32 poles
        altitude_lapse = max(0.0, heights[cid] - B.SEA_LEVEL) * 55.0
        maritime = 4.0 if land_dist[cid] <= 1 else (2.0 if land_dist[cid] <= 3 else 0.0)
        t = base_t - altitude_lapse + temp_noise.fbm(cid * 0.11, cid * 0.031, 3) * 3.0
        if is_ocean[cid]:
            t = base_t * 0.9 + maritime - 2.0
        temps.append(round(t, 2))

        prox = 0.0 if math.isinf(ocean_dist[cid]) else math.exp(-ocean_dist[cid] / 5.0)
        m = (moist_noise.fbm(cid * 0.13, cid * 0.041, 4) * 0.5 + 0.5) * 0.55 + prox * 0.55
        if heights[cid] > 0.7:
            m *= 0.7  # thin mountain air holds less moisture
        moistures.append(_clamp(m))

    # ---- rivers ------------------------------------------------------
    river_cells: set[int] = set()
    river_rng = Rng(seed, "gen", "rivers")
    sources = [
        c for c in land_cells
        if moistures[c] > 0.5 and B.SEA_LEVEL + 0.08 < heights[c] < 0.85
    ]
    river_rng.shuffle(sources)
    for src in sources[: p["rivers"]]:
        cur = src
        for _ in range(grid.size // 2):
            river_cells.add(cur)
            moistures[cur] = _clamp(moistures[cur] + 0.25)
            nbs = [n for n in grid.neighbors(cur, diagonal=True)]
            lower = [n for n in nbs if heights[n] < heights[cur] - 1e-9]
            if not lower:
                break
            cur = min(lower, key=lambda n: heights[n])
            if is_ocean[cur]:
                break

    # ---- volcanoes ---------------------------------------------------
    volcanic_cells: set[int] = set()
    for cid in land_cells:
        v = volcano_noise.f1(grid.lon_i(cid) * 0.35, grid.lat_i(cid) * 0.35)
        if v < 0.085 and heights[cid] > B.SEA_LEVEL + 0.05:
            volcanic_cells.add(cid)
            heights[cid] = _clamp(heights[cid] + 0.12)

    # ---- biomes ------------------------------------------------------
    cell_list: list[dict[str, Any]] = []
    for cid in range(grid.size):
        near_ocean = ocean_dist[cid] <= 1.0
        biome = B.classify(heights[cid], temps[cid], moistures[cid], near_ocean, cid in volcanic_cells)
        freshwater = cid in river_cells
        fertility = B.VEGETATION_CAPACITY.get(biome, 0.2)
        if freshwater:
            fertility = _clamp(fertility + 0.25)
        if 8 < temps[cid] < 28:
            fertility = _clamp(fertility + 0.1)
        cell_list.append({
            "id": cid,
            "lat": round(grid.lat_deg(cid), 2),
            "lon": round(grid.lon_deg(cid), 2),
            "height": round(heights[cid], 4),
            "temp": temps[cid],
            "moisture": round(moistures[cid], 4),
            "biome": biome,
            "fertility": round(fertility, 4),
            "freshwater": freshwater,
            "pollution": 0.0,
            "vegetation": 0.0,
            "owner": None,
            "cityId": None,
            "deposits": {},
            "droughtStreak": 0,
        })

    state: dict[str, Any] = {
        "meta": {
            "seed": seed,
            "tick": 0,
            "yearsPerTick": p["yearsPerTick"],
            "globalTempShift": 0.0,
            "co2": 1.0,
            "volcanicCells": sorted(volcanic_cells),
        },
        "grid": {"latBands": grid.lat_bands, "lonBands": grid.lon_bands},
        "cells": cell_list,
        "plants": {},
        "species": {},
        "civilizations": {},
        "cities": {},
        "technologies": {},
        "resources": {r["id"]: {k: r[k] for k in ("id", "name", "kind", "baseValue", "regen", "envImpact")} for r in RESOURCE_KINDS},
        "wars": {},
        "alliances": {},
        "diseases": {},
        "migrations": [],
        "tradeRoutes": {},
        "pendingEffects": [],
        "contributions": {},
        "events": events_state["events"],
        "eventCounter": events_state["eventCounter"],
    }
    log.state = state  # rebind to real state (keeps counter shared)

    log.emit(0, WORLD_GENESIS, importance=5, payload={
        "seed": seed,
        "grid": {"latBands": grid.lat_bands, "lonBands": grid.lon_bands},
        "landCells": len(land_cells),
        "oceanCells": len(ocean_cells),
        "rivers": len(river_cells),
        "volcanoes": len(volcanic_cells),
    })

    _place_resources(state, seed, log, p["deposits"])
    _spawn_plants(state, seed, log, p["plants"])
    _refresh_vegetation(state)
    _spawn_species(state, seed, log, p["species"])
    _found_civilizations(state, seed, log, p["civilizations"])
    _refresh_vegetation(state)
    return state


# ---------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------

def _place_resources(state: dict[str, Any], seed: int, log: EventLog, target: int) -> None:
    rng = Rng(seed, "gen", "resources")
    richness = WorleyNoise(seed, "richness")
    cells = state["cells"]
    placed = 0
    attempts = 0
    while placed < target and attempts < target * 60:
        attempts += 1
        cid = rng.randint(0, len(cells) - 1)
        cell = cells[cid]
        res = rng.weighted([(r, r["biomes"].get(cell["biome"], 0.0)) for r in RESOURCE_KINDS])
        w = res["biomes"].get(cell["biome"], 0.0)
        if w <= 0 or not rng.chance(min(1.0, w / 3.0)):
            continue
        if res["id"] in cell["deposits"]:
            continue
        qty = round(60.0 + 240.0 * (1.0 - richness.f1(cid * 0.21, cid * 0.07)), 1)
        cell["deposits"][res["id"]] = qty
        placed += 1
        log.emit(0, RESOURCE_DISCOVERED, importance=1, cell_id=cid,
                 payload={"resource": res["id"], "quantity": qty, "genesis": True})


# ---------------------------------------------------------------------
# Plants
# ---------------------------------------------------------------------

def _spawn_plants(state: dict[str, Any], seed: int, log: EventLog, count: int) -> None:
    rng = Rng(seed, "gen", "plants")
    cells = state["cells"]
    present = {c["biome"] for c in cells}
    biome_ids = [b for b in PLANT_ARCHETYPES if b in present] or [B.PLAINS]
    for i in range(count):
        biome = rng.weighted([(b, B.VEGETATION_CAPACITY[b]) for b in biome_ids])
        arch = PLANT_ARCHETYPES[biome]
        traits = {
            "size": _clamp(rng.gauss(arch["size"], 0.15)),
            "growthRate": _clamp(rng.gauss(arch["growthRate"], 0.15)),
            "waterNeed": _clamp(rng.gauss(arch["waterNeed"], 0.12)),
            "coldRes": _clamp(rng.gauss(arch["coldRes"], 0.12)),
            "heatRes": _clamp(rng.gauss(arch["heatRes"], 0.12)),
            "pollutionAbsorption": _clamp(rng.gauss(0.25, 0.2)),
            "energyStorage": _clamp(rng.gauss(0.3, 0.2)),
            "luminosity": _clamp(rng.gauss(0.05, 0.05)),
            "nutrition": _clamp(rng.gauss(0.45, 0.2)),
            "toxicity": _clamp(rng.gauss(0.1, 0.12)),
            "spreadRate": _clamp(rng.gauss(0.4, 0.15)),
        }
        candidates = [c["id"] for c in cells if c["biome"] == biome]
        if not candidates:
            continue
        origin = rng.choice(candidates)
        presence: dict[str, float] = {}
        frontier = [origin]
        target_cells = rng.randint(3, 12)
        while frontier and len(presence) < target_cells:
            cur = frontier.pop(rng.randint(0, len(frontier) - 1))
            cell = cells[cur]
            suit = _plant_suitability(traits, cell)
            if suit > 0.35 and str(cur) not in presence:
                presence[str(cur)] = round(0.2 + 0.5 * suit, 3)
                for nb in state_grid(state).neighbors(cur):
                    if rng.chance(0.7):
                        frontier.append(nb)
        if not presence:
            presence[str(origin)] = 0.3
        pid = f"pl_{i}"
        state["plants"][pid] = {
            "id": pid,
            "name": species_name(rng) + " flora",
            "homeBiome": biome,
            "traits": {k: round(v, 3) for k, v in traits.items()},
            "presence": presence,
            "extinct": False,
            "contributionId": None,
        }
    log.emit(0, PLANT_SPREAD, importance=1, payload={"genesis": True, "species": len(state["plants"])})


def _plant_suitability(traits: dict[str, float], cell: dict[str, Any]) -> float:
    if cell["biome"] in B.WATER_BIOMES:
        return 0.0
    water = 1.0 - abs(cell["moisture"] - traits["waterNeed"])
    temp_fit = 1.0
    if cell["temp"] < 0:
        temp_fit = traits["coldRes"] * max(0.0, 1.0 + cell["temp"] / 35.0)
    elif cell["temp"] > 32:
        temp_fit = traits["heatRes"] * max(0.0, 1.0 - (cell["temp"] - 32.0) / 30.0)
    return _clamp(0.45 * water + 0.35 * temp_fit + 0.2 * cell["fertility"])


# ---------------------------------------------------------------------
# Species (animals) + food web
# ---------------------------------------------------------------------

def _spawn_species(state: dict[str, Any], seed: int, log: EventLog, count: int) -> None:
    rng = Rng(seed, "gen", "species")
    cells = state["cells"]
    grid = state_grid(state)
    land_ids = [c["id"] for c in cells if B.is_habitable(c["biome"])]

    created: list[dict[str, Any]] = []
    for i in range(count):
        diet = rng.weighted([("herbivore", 0.55), ("omnivore", 0.25), ("carnivore", 0.2)])
        size = _clamp(rng.gauss(0.35 if diet == "herbivore" else 0.55, 0.25), 0.02, 1.0)
        temp_center = rng.uniform(-5.0, 30.0)
        temp_span = rng.uniform(6.0, 22.0)
        traits = {
            "size": round(size, 3),
            "reproductionRate": _clamp(rng.gauss(0.55 - size * 0.3, 0.12), 0.05, 1.0),
            "diet": diet,
            "tempMin": round(temp_center - temp_span / 2, 1),
            "tempMax": round(temp_center + temp_span / 2, 1),
            "waterNeed": _clamp(rng.gauss(0.5, 0.2)),
            "intelligence": _clamp(rng.gauss(0.3, 0.2)),
            "aggression": _clamp(rng.gauss(0.4 if diet != "carnivore" else 0.7, 0.15)),
            "speed": _clamp(rng.gauss(0.5, 0.2)),
            "adaptability": _clamp(rng.gauss(0.4, 0.18)),
            "mutationRate": _clamp(rng.gauss(0.06, 0.04), 0.005, 0.4),
            "sociality": _clamp(rng.gauss(0.5, 0.2)),
        }
        fitting = [cid for cid in land_ids if species_suitability(traits, cells[cid]) > 0.45]
        if fitting:
            home = rng.choice(fitting)
        else:
            home = max(land_ids, key=lambda c: species_suitability(traits, cells[c]))
        sid = f"sp_{i}"
        sp = {
            "id": sid,
            "name": species_name(rng),
            "traits": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in traits.items()},
            "homeCell": home,
            "prey": [],
            "populations": {},
            "extinct": False,
            "contributionId": None,
        }
        state["species"][sid] = sp
        created.append(sp)

    # food web: carnivores/omnivores prey on smaller species
    for sp in created:
        if sp["traits"]["diet"] == "herbivore":
            continue
        prey_pool = [
            o for o in created
            if o["id"] != sp["id"]
            and o["traits"]["size"] < sp["traits"]["size"] * 0.9
            and grid.distance_cells(o["homeCell"], sp["homeCell"]) < grid.lat_bands * 0.8
        ]
        rng.shuffle(prey_pool)
        sp["prey"] = [o["id"] for o in prey_pool[: rng.randint(1, min(4, len(prey_pool)))]] if prey_pool else []

    # initial populations near home cells
    for sp in created:
        suit_cells: list[tuple[int, float]] = []
        frontier = [sp["homeCell"]]
        seen: set[int] = set()
        while frontier and len(suit_cells) < 8:
            cur = frontier.pop(0)
            if cur in seen:
                continue
            seen.add(cur)
            s = species_suitability(sp["traits"], cells[cur])
            if s > 0.35:
                suit_cells.append((cur, s))
                frontier.extend(grid.neighbors(cur))
        base = 40.0 + 260.0 * (1.0 - sp["traits"]["size"])
        for cid, s in suit_cells:
            sp["populations"][str(cid)] = round(base * s, 1)
        if not sp["populations"]:
            sp["populations"][str(sp["homeCell"])] = round(base * 0.4, 1)
        log.emit(0, SPECIES_CREATED, importance=1, cell_id=sp["homeCell"],
                 species_ids=[sp["id"]], payload={"genesis": True, "diet": sp["traits"]["diet"]})


def species_suitability(traits: dict[str, Any], cell: dict[str, Any]) -> float:
    if cell["biome"] in B.WATER_BIOMES:
        return 0.0
    if not (traits["tempMin"] <= cell["temp"] <= traits["tempMax"]):
        return 0.1 * traits["adaptability"]
    water = 1.0 - abs(cell["moisture"] - traits["waterNeed"])
    food = cell["vegetation"] if traits["diet"] != "carnivore" else 0.5
    return _clamp(0.4 * water + 0.35 * food + 0.25 * cell["fertility"])


# ---------------------------------------------------------------------
# Civilizations
# ---------------------------------------------------------------------

def _found_civilizations(state: dict[str, Any], seed: int, log: EventLog, count: int) -> None:
    rng = Rng(seed, "gen", "civs")
    grid = state_grid(state)
    cells = state["cells"]

    def site_score(cid: int) -> float:
        c = cells[cid]
        if not B.is_habitable(c["biome"]):
            return -1.0
        s = c["fertility"] * 2.0 + (0.5 if c["freshwater"] else 0.0)
        for nb in grid.neighbors(cid):
            if cells[nb]["biome"] == B.COAST:
                s += 0.4
        return s

    candidates = sorted((c["id"] for c in cells), key=site_score, reverse=True)
    chosen: list[int] = []
    min_dist = grid.lat_bands * 0.3
    while len(chosen) < count and min_dist > 1.5:
        for cid in candidates:
            if len(chosen) >= count:
                break
            if site_score(cid) <= 0.4:
                break
            if all(grid.distance_cells(cid, other) > min_dist for other in chosen):
                chosen.append(cid)
        min_dist *= 0.7

    for i, cid in enumerate(chosen):
        civ_id = f"civ_{i}"
        personality = {
            "aggression": _clamp(rng.gauss(0.4, 0.2)),
            "innovation": _clamp(rng.gauss(0.5, 0.2)),
            "expansionism": _clamp(rng.gauss(0.5, 0.2)),
            "mercantilism": _clamp(rng.gauss(0.5, 0.2)),
        }
        culture = culture_name(rng)
        language = language_name(rng)
        city_id = f"city_{len(state['cities'])}"
        government = rng.choice(GOVERNMENTS)
        civ = {
            "id": civ_id,
            "name": civ_name(rng),
            "culture": culture,
            "language": language,
            "government": government,
            "population": 800,
            "techLevel": 1,
            "techProgress": 0.0,
            "military": 60.0,
            "treasury": 100.0,
            "food": 500.0,
            "happiness": 0.6,
            "health": 0.55,
            "stability": 0.65,
            "education": 0.2,
            "pollutionOutput": 0.05,
            "personality": {k: round(v, 3) for k, v in personality.items()},
            "cities": [city_id],
            "stockpiles": {},
            "relationships": {},
            "memory": [],
            "extinct": False,
            "contributionId": None,
        }
        state["civilizations"][civ_id] = civ
        state["cities"][city_id] = {
            "id": city_id,
            "civId": civ_id,
            "cellId": cid,
            "name": city_name(rng),
            "population": 800,
            "foundedTick": 0,
            "level": 1,
        }
        cells[cid]["owner"] = civ_id
        cells[cid]["cityId"] = city_id
        for nb in grid.neighbors(cid):
            if B.is_land(cells[nb]["biome"]) and cells[nb]["owner"] is None:
                cells[nb]["owner"] = civ_id
        found_evt = log.emit(0, CIVILIZATION_FOUNDED, importance=4, cell_id=cid, civ_ids=[civ_id],
                             payload={"name": civ["name"], "culture": culture, "language": language,
                                      "government": government})
        log.emit(0, CITY_CREATED, importance=3, cell_id=cid, civ_ids=[civ_id],
                 cause_event_id=found_evt["id"], payload={"name": state["cities"][city_id]["name"], "capital": True})
        for tier in (0, 1):
            for _ in range(2 if tier else 1):
                tid = f"tech_{len(state['technologies'])}"
                name = tech_name(rng, tier)
                state["technologies"][tid] = {
                    "id": tid, "name": name, "tier": tier,
                    "discoveredBy": civ_id, "tick": 0,
                }
                log.emit(0, TECHNOLOGY_DISCOVERED, importance=2, civ_ids=[civ_id],
                         cause_event_id=found_evt["id"], payload={"tech": name, "tier": tier})


# ---------------------------------------------------------------------

def _refresh_vegetation(state: dict[str, Any]) -> None:
    for c in state["cells"]:
        c["vegetation"] = 0.0
    for plant in state["plants"].values():
        for cid_s, density in plant["presence"].items():
            cell = state["cells"][int(cid_s)]
            cap = B.VEGETATION_CAPACITY.get(cell["biome"], 0.2)
            cell["vegetation"] = min(cap, cell["vegetation"] + density * 0.25)


def state_grid(state: dict[str, Any]) -> Grid:
    return Grid(state["grid"]["latBands"], state["grid"]["lonBands"])
