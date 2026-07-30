"""Climate & weather: CO2 balance, biome drift, storms, droughts,
wildfires, floods and volcanic eruptions. Nothing changes without a
physical driver; every change is event-sourced."""
from __future__ import annotations

from typing import Any

from .. import biomes as B
from ..common import alive_civs, clamp, eff_temp, grid_of, prob_dt
from ..events import (
    CLIMATE_CHANGED,
    DROUGHT_STARTED,
    FLOOD_OCCURRED,
    STORM_FORMED,
    VOLCANO_ERUPTED,
    WILDFIRE_STARTED,
    EventLog,
)
from ..rng import Rng

EMISSION_PER_CAPITA = 0.000012
ABSORPTION_PER_VEG = 0.0000009
CO2_MIN, CO2_MAX = 0.6, 3.0


def apply_climate(state: dict[str, Any]) -> None:
    meta = state["meta"]
    tick = meta["tick"]
    dt = meta["yearsPerTick"]
    seed = meta["seed"]
    rng = Rng(seed, "climate", tick)
    log = EventLog(state)
    grid = grid_of(state)
    cells = state["cells"]

    # ---- 1. carbon balance ------------------------------------------
    emissions = sum(
        c["pollutionOutput"] * c["population"] * EMISSION_PER_CAPITA for c in alive_civs(state)
    )
    absorption = sum(c["vegetation"] for c in cells) * ABSORPTION_PER_VEG
    old_co2 = meta["co2"]
    meta["co2"] = clamp(old_co2 + (emissions - absorption) * dt, CO2_MIN, CO2_MAX)
    new_shift = (meta["co2"] - 1.0) * 6.0
    if abs(new_shift - meta["globalTempShift"]) >= 0.5:
        log.emit(tick, CLIMATE_CHANGED, importance=4, payload={
            "driver": "co2",
            "co2": round(meta["co2"], 3),
            "tempShift": round(new_shift, 2),
            "emissions": round(emissions, 6),
            "absorption": round(absorption, 6),
        })
    meta["globalTempShift"] = round(new_shift, 3)

    # ---- 2. biome drift (hysteresis via transition chance) -----------
    transitions: dict[str, int] = {}
    for cell in cells:
        if cell["biome"] in B.WATER_BIOMES or cell["biome"] in (B.VOLCANIC, B.MOUNTAIN):
            continue
        target = B.classify(cell["height"], eff_temp(state, cell), cell["moisture"], False, False)
        if target != cell["biome"] and target not in (B.SWAMP,) and rng.chance(prob_dt(0.06, dt)):
            key = f"{cell['biome']}->{target}"
            transitions[key] = transitions.get(key, 0) + 1
            cell["biome"] = target
            cell["fertility"] = clamp(B.VEGETATION_CAPACITY.get(target, 0.2) + (0.25 if cell["freshwater"] else 0.0))
    if transitions:
        log.emit(tick, CLIMATE_CHANGED, importance=3, payload={
            "driver": "biome_drift", "transitions": transitions,
        })

    # ---- 3. storms ----------------------------------------------------
    storms = meta.setdefault("storms", [])
    spawn_chance = prob_dt(0.02, dt)
    for cell in cells:
        if cell["biome"] == B.OCEAN and eff_temp(state, cell) > 22 and rng.chance(spawn_chance):
            storms.append({"cell": cell["id"], "strength": round(rng.uniform(0.4, 1.0), 2), "ttl": rng.randint(3, 8)})
            log.emit(tick, STORM_FORMED, importance=2, cell_id=cell["id"],
                     payload={"strength": storms[-1]["strength"],
                              "driver": "warm_ocean_surface"})
            if len(storms) > 24:
                break
    survivors = []
    floods: list[int] = []
    for storm in storms:
        cell = cells[storm["cell"]]
        lat_i = grid.lat_i(storm["cell"])
        # trade winds push west in tropics, east in mid-latitudes
        dlon = -1 if grid.lat_bands * 0.25 < lat_i < grid.lat_bands * 0.75 else 1
        nxt = grid.cell_id(lat_i, grid.lon_i(storm["cell"]) + dlon)
        storm["cell"] = nxt
        storm["ttl"] -= dt
        target = cells[nxt]
        target["moisture"] = clamp(target["moisture"] + 0.05 * storm["strength"])
        if B.is_land(target["biome"]):
            storm["strength"] *= 0.7
            if target["freshwater"] and storm["strength"] > 0.5 and rng.chance(0.4):
                floods.append(nxt)
            if target["cityId"]:
                city = state["cities"].get(target["cityId"])
                if city and storm["strength"] > 0.65:
                    loss = int(city["population"] * 0.02 * storm["strength"])
                    city["population"] = max(0, city["population"] - loss)
                    civ = state["civilizations"].get(city["civId"])
                    if civ:
                        civ["population"] = max(0, civ["population"] - loss)
        if storm["ttl"] > 0 and storm["strength"] > 0.15:
            survivors.append(storm)
    meta["storms"] = survivors
    if floods:
        log.emit(tick, FLOOD_OCCURRED, importance=3, payload={
            "cells": floods[:12], "count": len(floods), "driver": "storm_landfall"})

    # ---- 4. drought & desertification --------------------------------
    drought_cells: list[int] = []
    for cell in cells:
        if not B.is_land(cell["biome"]):
            continue
        if cell["moisture"] < 0.18 and eff_temp(state, cell) > 18:
            cell["droughtStreak"] += dt
            if cell["droughtStreak"] >= 6 and cell["biome"] != B.DESERT:
                drought_cells.append(cell["id"])
                cell["moisture"] = clamp(cell["moisture"] - 0.02)
                if cell["droughtStreak"] >= 10 and cell["biome"] in (B.GRASSLAND, B.STEPPE, B.SAVANNA, B.PLAINS):
                    cell["biome"] = B.DESERT
                    cell["fertility"] = B.VEGETATION_CAPACITY[B.DESERT]
        else:
            cell["droughtStreak"] = 0
    if drought_cells:
        log.emit(tick, DROUGHT_STARTED, importance=3, payload={
            "cells": [c["id"] for c in cells if c["droughtStreak"] >= 6][:12],
            "desertified": len(drought_cells), "driver": "precipitation_deficit",
        })

    # ---- 5. wildfires -------------------------------------------------
    fire_cells: list[int] = []
    for cell in cells:
        if cell["biome"] in (B.TEMPERATE_FOREST, B.BOREAL_FOREST, B.RAINFOREST) \
                and cell["moisture"] < 0.22 and eff_temp(state, cell) > 24 \
                and rng.chance(prob_dt(0.015, dt)):
            fire_cells.append(cell["id"])
            cell["vegetation"] *= 0.4
            cell["pollution"] = clamp(cell["pollution"] + 0.1)
            for plant in state["plants"].values():
                key = str(cell["id"])
                if key in plant["presence"]:
                    plant["presence"][key] = round(plant["presence"][key] * 0.4, 3)
                    if plant["presence"][key] < 0.05:
                        del plant["presence"][key]
    for cid in fire_cells[:8]:
        log.emit(tick, WILDFIRE_STARTED, importance=2, cell_id=cid,
                 payload={"driver": "heat_low_humidity"})

    # ---- 6. volcanoes -------------------------------------------------
    for cid in meta.get("volcanicCells", []):
        if rng.chance(prob_dt(0.004, dt)):
            cell = cells[cid]
            affected = [cid] + grid.neighbors(cid, diagonal=True)
            for aid in affected:
                a = cells[aid]
                a["vegetation"] *= 0.2
                a["pollution"] = clamp(a["pollution"] + 0.3)
                if a["cityId"]:
                    city = state["cities"].get(a["cityId"])
                    if city:
                        loss = int(city["population"] * 0.3)
                        city["population"] = max(0, city["population"] - loss)
                        civ = state["civilizations"].get(city["civId"])
                        if civ:
                            civ["population"] = max(0, civ["population"] - loss)
                            civ["stability"] = clamp(civ["stability"] - 0.15)
            for plant in state["plants"].values():
                for aid in affected:
                    plant["presence"].pop(str(aid), None)
            meta["co2"] = clamp(meta["co2"] + 0.015, CO2_MIN, CO2_MAX)
            log.emit(tick, VOLCANO_ERUPTED, importance=4, cell_id=cid,
                     payload={"affectedCells": affected, "driver": "tectonic_pressure"})
