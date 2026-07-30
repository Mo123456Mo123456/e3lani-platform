"""Civilization agents: bookkeeping (food, economy, pollution, health),
population dynamics, and Utility-AI decision making (expand, research,
trade, war, ally, migrate, heal, govern, collapse).

Every decision is scored from observable state; memory of past wars and
alliances feeds future choices, so history matters.
"""
from __future__ import annotations

from typing import Any

from .. import biomes as B
from ..common import (
    alive_civs,
    border_index,
    civ_bonuses,
    civ_capacity,
    clamp,
    eff_temp,
    grid_of,
    prob_dt,
    relationship,
    territory_of,
)
from ..events import (
    CITY_CREATED,
    CIVILIZATION_COLLAPSED,
    CIVILIZATION_FOUNDED,
    GOVERNMENT_CHANGED,
    MIGRATION_STARTED,
    RESOURCE_DEPLETED,
    TERRITORY_CHANGED,
    EventLog,
)
from ..names import city_name, civ_name
from ..rng import Rng

FOOD_PER_CAPITA = 0.045
EXPAND_COST = 45.0


def apply_civilizations(state: dict[str, Any]) -> None:
    meta = state["meta"]
    tick = meta["tick"]
    dt = meta["yearsPerTick"]
    rng = Rng(meta["seed"], "civs", tick)
    log = EventLog(state)

    territory_map = _territory_map(state)
    for civ in alive_civs(state):
        _bookkeeping(state, civ, log, dt, tick, territory_map.get(civ["id"], []))
    borders = border_index(state)
    for civ in alive_civs(state):
        _decide(state, civ, rng, log, dt, tick, territory_map.get(civ["id"], []), borders)
    _splinter_check(state, rng, log, dt, tick)


def _territory_map(state: dict[str, Any]) -> dict[str, list[int]]:
    out: dict[str, list[int]] = {}
    for cell in state["cells"]:
        if cell["owner"]:
            out.setdefault(cell["owner"], []).append(cell["id"])
    return out


# ---------------------------------------------------------------------
# Bookkeeping
# ---------------------------------------------------------------------

def _bookkeeping(state: dict[str, Any], civ: dict[str, Any], log: EventLog, dt: float, tick: int,
                 territory: list[int]) -> None:
    cells = state["cells"]
    bonuses = civ_bonuses(state, civ)

    # food production & consumption
    produced = 0.0
    extraction_pollution = 0.0
    for cid in territory:
        cell = cells[cid]
        produced += cell["fertility"] * 58.0 * bonuses["farm"] * (1.0 - cell["pollution"] * 0.5)
        for rid, qty in list(cell["deposits"].items()):
            res = state["resources"][rid]
            if qty <= 0:
                continue
            rate = min(qty, 3.0 * (1.0 + 0.15 * civ["techLevel"]))
            if res["regen"] > 0:
                rate = min(rate, qty * res["regen"] * 12 + 0.5)
                cell["deposits"][rid] = min(qty + res["regen"] * dt * 2, qty + 1) - rate
            else:
                cell["deposits"][rid] = qty - rate
            value = rate * res["baseValue"]
            civ["treasury"] += value * dt
            civ["stockpiles"][rid] = civ["stockpiles"].get(rid, 0.0) + rate * dt
            extraction_pollution += res["envImpact"] * 0.002 * rate
            if res["id"] == "fish" or res["kind"] == "food":
                produced += rate * 14.0
            if cell["deposits"][rid] <= 0.5 and res["regen"] == 0:
                del cell["deposits"][rid]
                log.emit(tick, RESOURCE_DEPLETED, importance=2, cell_id=cid, civ_ids=[civ["id"]],
                         payload={"resource": rid, "cause": "extraction"})

    civ["food"] = max(0.0, civ["food"] + (produced - civ["population"] * FOOD_PER_CAPITA) * dt)
    starving = civ["food"] <= 1.0 and produced < civ["population"] * FOOD_PER_CAPITA
    civ["starveYears"] = (civ.get("starveYears", 0.0) + dt) if starving else 0.0

    # pollution: produced locally, partially dispersed
    civ["pollutionOutput"] = clamp(
        0.02 + civ["population"] * 0.0000004 * (1 + civ["techLevel"] * 0.3), 0, 0.5)
    for cid in territory:
        cell = cells[cid]
        if cell["cityId"]:
            cell["pollution"] = clamp(cell["pollution"] + (civ["pollutionOutput"] * 0.05 + extraction_pollution) * dt)
        else:
            cell["pollution"] = clamp(cell["pollution"] - 0.005 * dt)

    # health & happiness
    bonuses_med = bonuses["medicine"]
    avg_poll = 0.0
    if territory:
        avg_poll = sum(cells[c]["pollution"] for c in territory) / len(territory)
    civ["health"] = clamp(0.45 + 0.1 * bonuses_med - avg_poll * 0.6 - (0.2 if starving else 0.0))
    war_weariness = sum(1 for w in state["wars"].values()
                        if w["active"] and civ["id"] in (w["attacker"], w["defender"])) * 0.12
    civ["happiness"] = clamp(
        0.5 + (0.2 if not starving else -0.3) - war_weariness - avg_poll * 0.4
        + (civ["treasury"] / (civ["population"] + 1)) * 0.02)
    civ["stability"] = clamp(
        civ["stability"] + (civ["happiness"] - 0.5) * 0.05 * dt - (0.08 * dt if starving else 0.0))

    # population
    capacity = civ_capacity(state, civ) * bonuses["capacity"]
    growth_rate = 0.02 * (0.5 + civ["health"]) * (0.5 + civ["happiness"])
    growth = growth_rate * dt * civ["population"] * (1.0 - civ["population"] / max(capacity, 500.0))
    if starving:
        growth -= civ["population"] * 0.03 * dt
    civ["population"] = max(0.0, civ["population"] + growth)

    # distribute population across cities (capital share model)
    city_share = civ["population"] / max(1, len(civ["cities"]))
    for city_id in civ["cities"]:
        city = state["cities"].get(city_id)
        if city:
            city["population"] = int(city_share)

    # memory: wounds fade slowly (slower than border friction builds them)
    for rel in civ["relationships"].values():
        rel["grievances"] = max(0, rel["grievances"] - 0.01 * dt)
        rel["trust"] = clamp(rel["trust"] + (0.005 if rel["trade"] else 0.001) * dt, -1.0, 1.0)


# ---------------------------------------------------------------------
# Decisions (Utility AI)
# ---------------------------------------------------------------------

def _decide(state: dict[str, Any], civ: dict[str, Any], rng: Rng, log: EventLog, dt: float, tick: int,
            territory: list[int], borders: dict[tuple[str, str], list[int]]) -> None:
    grid = grid_of(state)
    cells = state["cells"]
    p = civ["personality"]
    actions: list[tuple[float, str, dict[str, Any]]] = []
    frontier: dict[int, float] = {}
    for cid in territory:
        for nb in grid.neighbors(cid, diagonal=True):
            cell = cells[nb]
            if cell["owner"] is None and B.is_habitable(cell["biome"]):
                score = cell["fertility"] * 2 + (0.4 if cell["freshwater"] else 0) + len(cell["deposits"]) * 0.6
                frontier[nb] = max(frontier.get(nb, 0.0), score)
    if frontier and civ["treasury"] >= EXPAND_COST:
        best_cell, best_score = max(frontier.items(), key=lambda kv: kv[1])
        actions.append((p["expansionism"] * best_score * 1.4, "expand", {"cell": best_cell, "score": best_score}))

    research_utility = p["innovation"] * (0.5 + civ["education"]) * 3.0
    if civ["treasury"] > 40:
        actions.append((research_utility, "research", {}))

    for other in alive_civs(state):
        if other["id"] == civ["id"]:
            continue
        rel = relationship(state, civ["id"], other["id"])
        if rel["atWar"]:
            continue
        pair = (min(civ["id"], other["id"]), max(civ["id"], other["id"]))
        adjacent = pair in borders
        if adjacent and not rel["trade"] and rel["trust"] > 0.05:
            actions.append((p["mercantilism"] * (1.2 + rel["trust"]) * 2.0, "trade", {"other": other["id"]}))
        if adjacent and rel["trust"] > 0.55 and not rel["allied"]:
            threat = sum(1 for w in state["wars"].values() if w["active"])
            actions.append(((rel["trust"] + 0.1 * threat) * 2.2, "ally", {"other": other["id"]}))

    if civ.get("starveYears", 0.0) >= 2:
        actions.append((3.5, "migrate", {}))
    if any(d["active"] for d in state["diseases"].values() if civ["id"] in d.get("civs", [])):
        actions.append((3.0, "heal", {}))
    if civ["stability"] < 0.3:
        actions.append((2.2, "govern", {}))

    actions.sort(key=lambda a: a[0], reverse=True)
    budget = 3 if civ["treasury"] > EXPAND_COST * 3 else 2
    for _, kind, data in actions[:budget]:
        _execute(state, civ, kind, data, rng, log, dt, tick)


def _execute(state: dict[str, Any], civ: dict[str, Any], kind: str, data: dict[str, Any],
             rng: Rng, log: EventLog, dt: float, tick: int) -> None:
    cells = state["cells"]
    grid = grid_of(state)

    if kind == "expand":
        cid = data["cell"]
        civ["treasury"] -= EXPAND_COST
        cells[cid]["owner"] = civ["id"]
        for nb in grid.neighbors(cid):
            if cells[nb]["owner"] is None and B.is_land(cells[nb]["biome"]) and rng.chance(0.5):
                cells[nb]["owner"] = civ["id"]
        if data["score"] > 1.7 and civ["population"] > 350:
            city_id = f"city_{len(state['cities'])}"
            name = city_name(rng)
            settlers = int(civ["population"] * 0.08)
            state["cities"][city_id] = {
                "id": city_id, "civId": civ["id"], "cellId": cid, "name": name,
                "population": settlers, "foundedTick": tick, "level": 1,
            }
            cells[cid]["cityId"] = city_id
            civ["cities"].append(city_id)
            log.emit(tick, CITY_CREATED, importance=3, cell_id=cid, civ_ids=[civ["id"]],
                     payload={"name": name, "reason": "expansion"})
        else:
            log.emit(tick, TERRITORY_CHANGED, importance=1, cell_id=cid, civ_ids=[civ["id"]],
                     payload={"reason": "expansion"})

    elif kind == "research":
        invest = min(civ["treasury"] * 0.15, 30.0)
        civ["treasury"] -= invest
        civ["techProgress"] += invest * civ["personality"]["innovation"] * (1 + civ["education"]) * dt
        civ["education"] = clamp(civ["education"] + 0.002 * dt)

    elif kind == "trade":
        rel = relationship(state, civ["id"], data["other"])
        rel["trade"] = True
        other_rel = relationship(state, data["other"], civ["id"])
        other_rel["trade"] = True
        # route creation handled by economy system (needs pathfinding)

    elif kind == "ally":
        aid = f"al_{len(state['alliances'])}"
        other = state["civilizations"][data["other"]]
        rel = relationship(state, civ["id"], other["id"])
        if rng.chance(0.35 + max(0.0, rel["trust"]) * 0.6):
            state["alliances"][aid] = {
                "id": aid, "members": sorted([civ["id"], other["id"]]),
                "formedTick": tick, "active": True,
            }
            rel["allied"] = True
            relationship(state, other["id"], civ["id"])["allied"] = True
            log.emit(tick, "ALLIANCE_CREATED", importance=3, civ_ids=[civ["id"], other["id"]],
                     payload={"members": [civ["name"], other["name"]],
                              "reason": "mutual_trust"})

    elif kind == "migrate":
        owned = territory_of(state, civ["id"])
        if not owned:
            return
        scored = sorted(
            owned,
            key=lambda c: cells[c]["fertility"] - cells[c]["pollution"] - (0.5 if cells[c]["droughtStreak"] > 3 else 0),
            reverse=True,
        )
        best = scored[0]
        worst_city = min(
            (state["cities"][cid] for cid in civ["cities"] if cid in state["cities"]),
            key=lambda c: cells[c["cellId"]]["fertility"] - cells[c["cellId"]]["pollution"],
            default=None,
        )
        if worst_city and cells[best]["id"] != worst_city["cellId"]:
            movers = int(worst_city["population"] * 0.2)
            if movers > 80:
                state["migrations"].append({
                    "id": f"mig_{len(state['migrations'])}", "civId": civ["id"],
                    "fromCell": worst_city["cellId"], "toCell": best, "size": movers, "tick": tick,
                })
                worst_city["population"] -= movers
                log.emit(tick, MIGRATION_STARTED, importance=2, cell_id=best, civ_ids=[civ["id"]],
                         payload={"size": movers, "reason": "environmental_stress"})

    elif kind == "heal":
        invest = min(civ["treasury"] * 0.2, 40.0)
        civ["treasury"] -= invest
        civ["health"] = clamp(civ["health"] + 0.05 * dt)

    elif kind == "govern":
        old = civ["government"]
        options = ["tribal_council", "monarchy", "oligarchy", "republic", "theocracy", "chiefdom"]
        options.remove(old)
        civ["government"] = rng.choice(options)
        civ["stability"] = clamp(civ["stability"] + 0.12)
        log.emit(tick, GOVERNMENT_CHANGED, importance=3, civ_ids=[civ["id"]],
                 payload={"from": old, "to": civ["government"], "cause": "instability"})


def _splinter_check(state: dict[str, Any], rng: Rng, log: EventLog, dt: float, tick: int) -> None:
    for civ in list(alive_civs(state)):
        if civ["stability"] <= 0.06 and civ["population"] < 250:
            civ["extinct"] = True
            for cid in territory_of(state, civ["id"]):
                state["cells"][cid]["owner"] = None
                state["cells"][cid]["cityId"] = None
            for city_id in civ["cities"]:
                state["cities"].pop(city_id, None)
            for w in state["wars"].values():
                if civ["id"] in (w["attacker"], w["defender"]):
                    w["active"] = False
            log.emit(tick, CIVILIZATION_COLLAPSED, importance=4, civ_ids=[civ["id"]],
                     payload={"name": civ["name"], "cause": "instability"})
        elif civ["stability"] < 0.2 and len(civ["cities"]) > 2 and rng.chance(prob_dt(0.05, dt)):
            # breakaway province founds a successor civilization
            new_id = f"civ_{len(state['civilizations'])}"
            city_id = civ["cities"][-1]
            city = state["cities"][city_id]
            new_civ = {
                "id": new_id,
                "name": civ_name(rng),
                "culture": civ["culture"],
                "language": civ["language"],
                "government": "tribal_council",
                "population": city["population"],
                "techLevel": civ["techLevel"],
                "techProgress": 0.0,
                "military": civ["military"] * 0.3,
                "treasury": civ["treasury"] * 0.2,
                "food": 200.0,
                "happiness": 0.55, "health": civ["health"], "stability": 0.55,
                "education": civ["education"], "pollutionOutput": 0.05,
                "personality": dict(civ["personality"]),
                "cities": [city_id],
                "stockpiles": {}, "relationships": {}, "memory": [],
                "extinct": False, "contributionId": None,
            }
            civ["cities"].remove(city_id)
            civ["treasury"] *= 0.8
            civ["population"] -= city["population"]
            city["civId"] = new_id
            cells = state["cells"]
            cells[city["cellId"]]["owner"] = new_id
            state["civilizations"][new_id] = new_civ
            relationship(state, new_id, civ["id"])["trust"] = -0.3
            relationship(state, new_id, civ["id"])["grievances"] = 1
            log.emit(tick, CIVILIZATION_FOUNDED, importance=4, cell_id=city["cellId"],
                     civ_ids=[new_id, civ["id"]],
                     payload={"name": new_civ["name"], "cause": "secession", "from": civ["name"]})


def _borders(state: dict[str, Any], a: str, b: str) -> bool:
    grid = grid_of(state)
    cells = state["cells"]
    for cell in cells:
        if cell["owner"] == a:
            for nb in grid.neighbors(cell["id"], diagonal=True):
                if cells[nb]["owner"] == b:
                    return True
    return False
