"""Ecosystem dynamics: plant growth/spread, predator–prey population
dynamics (Lotka–Volterra inspired), carrying capacity, migration,
mutation and extinction.

Event throttling is rule-based and deterministic: routine spread events
aggregate per species; everything notable (colonisation of new regions,
mutations, extinctions, contribution-derived life) is always logged.
"""
from __future__ import annotations

from typing import Any

from .. import biomes as B
from ..common import clamp, eff_temp, grid_of, prob_dt, total_species_population
from ..events import (
    PLANT_SPREAD,
    SPECIES_EXTINCT,
    SPECIES_MIGRATED,
    SPECIES_MUTATED,
    EventLog,
)
from ..generator import _plant_suitability, species_suitability
from ..names import species_name
from ..rng import Rng

MAX_SPREAD_EVENTS_PER_TICK = 30
EXTINCTION_FLOOR = 4.0


def apply_ecology(state: dict[str, Any]) -> None:
    meta = state["meta"]
    tick = meta["tick"]
    dt = meta["yearsPerTick"]
    rng = Rng(meta["seed"], "ecology", tick)
    log = EventLog(state)
    grid = grid_of(state)
    cells = state["cells"]

    _update_plants(state, rng, log, grid, dt, tick)
    _refresh_cell_vegetation(state)
    _update_species(state, rng, log, grid, dt, tick)


# ---------------------------------------------------------------------
# Plants
# ---------------------------------------------------------------------

def _update_plants(state: dict[str, Any], rng: Rng, log: EventLog, grid, dt: float, tick: int) -> None:
    cells = state["cells"]
    spread_events = 0
    for pid in sorted(state["plants"]):
        plant = state["plants"][pid]
        if plant["extinct"]:
            continue
        traits = plant["traits"]
        new_cells: list[int] = []
        dead_cells: list[str] = []
        for key in sorted(plant["presence"]):
            cid = int(key)
            cell = cells[cid]
            suit = _plant_suitability_eff(state, traits, cell)
            density = plant["presence"][key]
            cap = B.VEGETATION_CAPACITY.get(cell["biome"], 0.2) * 4.0
            if suit < 0.12:
                density *= max(0.0, 1.0 - 0.35 * dt)
            else:
                growth = traits["growthRate"] * dt * 0.25 * density * (1.0 - density / max(cap, 0.05))
                density += growth * suit
            # water stress
            if cell["moisture"] < traits["waterNeed"] * 0.35:
                density *= max(0.0, 1.0 - 0.2 * dt)
            # pollution absorption
            if traits["pollutionAbsorption"] > 0.1 and cell["pollution"] > 0.01:
                absorbed = traits["pollutionAbsorption"] * density * 0.05 * dt
                cell["pollution"] = clamp(cell["pollution"] - absorbed)
            density = clamp(density, 0.0, cap)
            if density < 0.02:
                dead_cells.append(key)
            else:
                plant["presence"][key] = round(density, 3)
        for key in dead_cells:
            del plant["presence"][key]

        # spread to neighbouring suitable cells
        prev_total = len(plant["presence"])
        frontier = sorted({nb for key in plant["presence"] for nb in grid.neighbors(int(key), diagonal=True)})
        for nb in frontier:
            if str(nb) in plant["presence"]:
                continue
            cell = cells[nb]
            suit = _plant_suitability_eff(state, traits, cell)
            if suit > 0.3 and rng.chance(prob_dt(traits["spreadRate"] * suit * 0.3, dt)):
                plant["presence"][str(nb)] = round(0.1 + 0.2 * suit, 3)
                new_cells.append(nb)
                if len(new_cells) >= 4:
                    break

        if not plant["presence"]:
            plant["extinct"] = True
            log.emit(tick, SPECIES_EXTINCT, importance=2, plant_ids=[pid],
                     payload={"kind": "plant", "name": plant["name"],
                              "cause": "habitat_loss"})
        elif new_cells:
            # milestone rule: log when the plant's range crosses a 12-cell
            # boundary (or always for user-contributed plants)
            new_total = len(plant["presence"])
            milestone = prev_total // 12 != new_total // 12
            notable = plant.get("contributionId") or milestone
            if notable and spread_events < MAX_SPREAD_EVENTS_PER_TICK:
                spread_events += 1
                log.emit(tick, PLANT_SPREAD, importance=1 if not plant.get("contributionId") else 2,
                         plant_ids=[pid],
                         contribution_id=plant.get("contributionId"),
                         payload={"name": plant["name"], "newCells": new_cells,
                                  "totalCells": new_total, "reason": "natural_spread"})


def _plant_suitability_eff(state: dict[str, Any], traits: dict[str, float], cell: dict[str, Any]) -> float:
    eff = dict(cell)
    eff["temp"] = eff_temp(state, cell)
    return _plant_suitability(traits, eff)


# ---------------------------------------------------------------------
# Species
# ---------------------------------------------------------------------

def _update_species(state: dict[str, Any], rng: Rng, log: EventLog, grid, dt: float, tick: int) -> None:
    cells = state["cells"]
    predation: dict[str, dict[str, float]] = {}  # prey_id -> cell -> eaten fraction

    # growth pass (herbivores & omnivores first for deterministic order)
    order = sorted(state["species"].values(), key=lambda s: (s["traits"]["diet"] == "carnivore", s["id"]))
    for sp in order:
        if sp["extinct"]:
            continue
        traits = sp["traits"]
        migrated: list[int] = []
        for key in sorted(list(sp["populations"].keys())):
            cid = int(key)
            cell = cells[cid]
            suit = species_suitability_eff(state, traits, cell)
            pop = sp["populations"][key]
            k = carrying_capacity(state, sp, cell, suit)
            r = traits["reproductionRate"] * 0.12
            growth = r * dt * pop * (1.0 - pop / max(k, 1.0))
            if suit < 0.15:
                growth -= pop * 0.12 * dt  # harsh environment decline
            pop = max(0.0, pop + growth)
            # predation pressure applied after (below)
            eaten = predation.get(sp["id"], {}).get(key, 0.0)
            pop *= max(0.0, 1.0 - eaten)
            if pop < 1.0:
                del sp["populations"][key]
                continue
            sp["populations"][key] = round(pop, 1)
            # migration when overcrowded or unsuitable
            if (pop > k * 0.95 or suit < 0.25) and rng.chance(prob_dt(0.3, dt)):
                best = None
                best_s = -1.0
                for nb in grid.neighbors(cid):
                    s = species_suitability_eff(state, traits, cells[nb])
                    if s > best_s:
                        best, best_s = nb, s
                if best is not None and best_s > suit + 0.08 and best_s > 0.3:
                    movers = round(pop * 0.25, 1)
                    sp["populations"][key] = round(pop - movers, 1)
                    bkey = str(best)
                    is_new = bkey not in sp["populations"]
                    sp["populations"][bkey] = round(sp["populations"].get(bkey, 0.0) + movers, 1)
                    if is_new:
                        migrated.append(best)

        # predation: carnivores eat a fraction of prey in shared cells
        if traits["diet"] in ("carnivore", "omnivore") and sp["prey"]:
            need = sum(sp["populations"].values()) * traits["size"] * 0.5
            consumed = 0.0
            for prey_id in sp["prey"]:
                prey = state["species"].get(prey_id)
                if not prey or prey["extinct"]:
                    continue
                for key, pop in sp["populations"].items():
                    if key in prey["populations"] and prey["populations"][key] > 2:
                        frac = min(0.12, traits["aggression"] * 0.06 * dt)
                        predation.setdefault(prey_id, {})[key] = min(
                            0.35, predation.setdefault(prey_id, {}).get(key, 0.0) + frac)
                        consumed += prey["populations"][key] * frac * prey["traits"]["size"]
                        if consumed > need:
                            break
            if consumed < need * 0.3:
                for key in list(sp["populations"]):
                    sp["populations"][key] = round(sp["populations"][key] * max(0.0, 1.0 - 0.04 * dt), 1)

        total = total_species_population(sp)
        if total < EXTINCTION_FLOOR:
            sp["extinct"] = True
            sp["populations"] = {}
            log.emit(tick, SPECIES_EXTINCT, importance=3, species_ids=[sp["id"]],
                     payload={"name": sp["name"], "cause": "population_collapse"})
            continue
        if migrated:
            notable = sp.get("contributionId") or len(migrated) >= 2
            if notable:
                log.emit(tick, SPECIES_MIGRATED, importance=1 if not sp.get("contributionId") else 2,
                         species_ids=[sp["id"]], contribution_id=sp.get("contributionId"),
                         payload={"name": sp["name"], "newCells": migrated[:6],
                                  "reason": "habitat_search"})
        # mutation → subspecies
        if rng.chance(prob_dt(traits["mutationRate"] * 0.05, dt)) and total > 200:
            _mutate_species(state, sp, rng, log, tick)


def carrying_capacity(state: dict[str, Any], sp: dict[str, Any], cell: dict[str, Any], suit: float) -> float:
    base = B.VEGETATION_CAPACITY.get(cell["biome"], 0.2) * 900.0
    size_factor = max(0.05, 1.2 - sp["traits"]["size"])
    if sp["traits"]["diet"] == "carnivore":
        prey_biomass = 0.0
        for prey_id in sp["prey"]:
            prey = state["species"].get(prey_id)
            if prey and not prey["extinct"]:
                prey_biomass += prey["populations"].get(str(cell["id"]), 0.0) * prey["traits"]["size"]
        base = prey_biomass * 0.4 + 10.0
    return max(5.0, base * size_factor * max(0.05, suit))


def species_suitability_eff(state: dict[str, Any], traits: dict[str, Any], cell: dict[str, Any]) -> float:
    eff = dict(cell)
    eff["temp"] = eff_temp(state, cell)
    return species_suitability(traits, eff)


def _mutate_species(state: dict[str, Any], parent: dict[str, Any], rng: Rng, log: EventLog, tick: int) -> None:
    idx = len(state["species"])
    sid = f"sp_{idx}"
    traits = dict(parent["traits"])
    shift_key = rng.choice(["tempMin", "tempMax", "size", "reproductionRate", "aggression"])
    if shift_key in ("tempMin", "tempMax"):
        traits[shift_key] = round(traits[shift_key] + rng.uniform(-4, 4), 1)
    else:
        traits[shift_key] = round(clamp(traits[shift_key] * rng.uniform(0.75, 1.3)), 3)
    traits["mutationRate"] = parent["traits"]["mutationRate"]
    donor_cell = max(parent["populations"].items(), key=lambda kv: kv[1])[0]
    seed_pop = round(parent["populations"][donor_cell] * 0.2, 1)
    parent["populations"][donor_cell] = round(parent["populations"][donor_cell] - seed_pop, 1)
    state["species"][sid] = {
        "id": sid,
        "name": species_name(rng),
        "traits": traits,
        "homeCell": int(donor_cell),
        "prey": list(parent["prey"]),
        "populations": {donor_cell: seed_pop},
        "extinct": False,
        "parentId": parent["id"],
        "contributionId": parent.get("contributionId"),
    }
    log.emit(tick, SPECIES_MUTATED, importance=2, cell_id=int(donor_cell),
             species_ids=[sid, parent["id"]], contribution_id=parent.get("contributionId"),
             payload={"parent": parent["name"], "child": state["species"][sid]["name"],
                      "traitShift": shift_key, "cause": "mutation"})


def _refresh_cell_vegetation(state: dict[str, Any]) -> None:
    for c in state["cells"]:
        c["vegetation"] = 0.0
    for plant in state["plants"].values():
        if plant["extinct"]:
            continue
        for key, density in plant["presence"].items():
            cell = state["cells"][int(key)]
            cap = B.VEGETATION_CAPACITY.get(cell["biome"], 0.2)
            cell["vegetation"] = min(cap, cell["vegetation"] + density * 0.25)
