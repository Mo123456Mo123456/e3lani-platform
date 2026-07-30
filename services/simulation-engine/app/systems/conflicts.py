"""Wars and their consequences.

Wars never start randomly: a structural score combines resource
competition, border friction, grievances (memory), power asymmetry,
food stress and aggression. Outcomes depend on forces, technology,
terrain, supply distance, morale, alliances and a luck term — and wars
produce refugees, border changes, treaties, tech pressure and disease.
"""
from __future__ import annotations

from typing import Any

from .. import biomes as B
from ..common import alive_civs, border_index, civ_bonuses, clamp, grid_of, prob_dt, relationship
from ..events import (
    ALLIANCE_BROKEN,
    CITY_CAPTURED,
    MIGRATION_STARTED,
    TERRITORY_CHANGED,
    WAR_ENDED,
    WAR_STARTED,
    EventLog,
)
from ..rng import Rng

WAR_THRESHOLD = 0.52
MAX_WARS_PER_TICK = 1
MAX_ACTIVE_WARS = 3


def war_score(state: dict[str, Any], a: dict[str, Any], b: dict[str, Any],
              borders: dict[tuple[str, str], list[int]]) -> tuple[float, list[dict[str, Any]]]:
    rel = relationship(state, a["id"], b["id"])
    factors: list[dict[str, Any]] = []

    def add(name: str, weight: float) -> None:
        if weight > 0.01:
            factors.append({"factor": name, "weight": round(weight, 3)})

    food_stress = 0.0
    if a["food"] < 50 or b["food"] < 50:
        food_stress = 0.18
    grievance = min(0.3, rel["grievances"] * 0.08)
    aggression = a["personality"]["aggression"] * 0.2
    power_ratio = a["military"] / max(1.0, b["military"])
    opportunism = 0.14 if power_ratio > 1.5 else (0.0 if power_ratio > 0.8 else -0.08)
    deterrence = -0.12 if _allied(state, b["id"]) else 0.0
    scarcity = _resource_overlap(state, a["id"], b["id"]) * 0.15
    pair = (min(a["id"], b["id"]), max(a["id"], b["id"]))
    border = 0.1 if pair in borders else -0.05
    trust_drag = rel["trust"] * -0.2
    from ..common import civ_capacity
    pressure_ratio = a["population"] / max(civ_capacity(state, a), 1.0)
    pop_pressure = clamp((pressure_ratio - 0.75) / 0.25) * 0.14

    add("food_stress", food_stress)
    add("grievances", grievance)
    add("aggression", aggression)
    add("power_asymmetry", opportunism)
    add("alliance_deterrence", deterrence)
    add("resource_competition", scarcity)
    add("border_friction", border)
    add("population_pressure", pop_pressure)
    add("trust", trust_drag)

    score = (0.28 + food_stress + grievance + aggression + opportunism + deterrence
             + scarcity + border + pop_pressure + trust_drag)
    return clamp(score), sorted(factors, key=lambda f: -f["weight"])


def apply_conflicts(state: dict[str, Any]) -> None:
    meta = state["meta"]
    tick = meta["tick"]
    dt = meta["yearsPerTick"]
    rng = Rng(meta["seed"], "conflict", tick)
    log = EventLog(state)

    borders = border_index(state)
    # border friction: neighbouring powers slowly accumulate grievances,
    # so tensions have history and wars have memory-driven causes
    for pair in borders:
        a, b = pair
        if a in state["civilizations"] and b in state["civilizations"]:
            for x, y in ((a, b), (b, a)):
                rel = relationship(state, x, y)
                rel["grievances"] += (0.015 if rel["allied"] else 0.05) * dt
    _maybe_start_wars(state, rng, log, dt, tick, borders)
    _progress_wars(state, rng, log, dt, tick)


def _maybe_start_wars(state: dict[str, Any], rng: Rng, log: EventLog, dt: float, tick: int,
                      borders: dict[tuple[str, str], list[int]]) -> None:
    active = sum(1 for w in state["wars"].values() if w["active"])
    if active >= MAX_ACTIVE_WARS:
        return
    civs = list(alive_civs(state))
    started = 0
    for a in civs:
        if started >= MAX_WARS_PER_TICK:
            break
        best_target = None
        best_score = 0.0
        best_causes: list[dict[str, Any]] = []
        for b in civs:
            if b["id"] == a["id"]:
                continue
            rel = relationship(state, a["id"], b["id"])
            if rel["atWar"]:
                continue
            if rel["allied"]:
                # betrayal: deep accumulated grievances can shatter an alliance
                if rel["grievances"] > 2.5 and a["personality"]["aggression"] > 0.45:
                    rel["allied"] = False
                    relationship(state, b["id"], a["id"])["allied"] = False
                    for al in state["alliances"].values():
                        if al["active"] and a["id"] in al["members"] and b["id"] in al["members"]:
                            al["active"] = False
                    log.emit(tick, ALLIANCE_BROKEN, importance=3, civ_ids=[a["id"], b["id"]],
                             payload={"reason": "betrayal", "grievances": round(rel["grievances"], 2)})
                else:
                    continue
            pair = (min(a["id"], b["id"]), max(a["id"], b["id"]))
            if pair not in borders:
                continue
            score, causes = war_score(state, a, b, borders)
            if score > best_score:
                best_target, best_score, best_causes = b, score, causes
        if best_target and best_score >= WAR_THRESHOLD and rng.chance(prob_dt((best_score - 0.40), dt)):
            wid = f"war_{len(state['wars'])}"
            pair = (min(a["id"], best_target["id"]), max(a["id"], best_target["id"]))
            fronts = sorted(set(borders.get(pair, [])))
            state["wars"][wid] = {
                "id": wid, "attacker": a["id"], "defender": best_target["id"],
                "startTick": tick, "fronts": fronts, "intensity": 0.5,
                "wearinessA": 0.0, "wearinessB": 0.0, "active": True,
                "causes": best_causes,
            }
            relationship(state, a["id"], best_target["id"])["atWar"] = True
            relationship(state, best_target["id"], a["id"])["atWar"] = True
            for rel in (relationship(state, a["id"], best_target["id"]),
                        relationship(state, best_target["id"], a["id"])):
                rel["grievances"] += 2
                rel["trust"] = clamp(rel["trust"] - 0.5, -1, 1)
                if rel["allied"]:
                    rel["allied"] = False
                    for al in state["alliances"].values():
                        if al["active"] and a["id"] in al["members"] and best_target["id"] in al["members"]:
                            al["active"] = False
                            log.emit(tick, ALLIANCE_BROKEN, importance=3,
                                     civ_ids=[a["id"], best_target["id"]],
                                     payload={"reason": "war_declaration"})
            _remember(state, a["id"], f"attacked:{best_target['id']}:{tick}")
            _remember(state, best_target["id"], f"attacked_by:{a['id']}:{tick}")
            log.emit(tick, WAR_STARTED, importance=5, civ_ids=[a["id"], best_target["id"]],
                     payload={"attacker": a["name"], "defender": best_target["name"],
                              "causes": best_causes, "score": round(best_score, 3)})
            started += 1


def _progress_wars(state: dict[str, Any], rng: Rng, log: EventLog, dt: float, tick: int) -> None:
    cells = state["cells"]
    grid = grid_of(state)
    for war in state["wars"].values():
        if not war["active"]:
            continue
        atk = state["civilizations"].get(war["attacker"])
        dfn = state["civilizations"].get(war["defender"])
        if not atk or not dfn or atk["extinct"] or dfn["extinct"]:
            war["active"] = False
            continue

        str_a = _war_strength(state, atk, war["fronts"], rng, True)
        str_d = _war_strength(state, dfn, war["fronts"], rng, False)
        attacker_wins = str_a > str_d
        loser, winner = (dfn, atk) if attacker_wins else (atk, dfn)

        casualties_loser = loser["population"] * 0.004 * dt * war["intensity"]
        casualties_winner = winner["population"] * 0.002 * dt * war["intensity"]
        loser["population"] = max(0.0, loser["population"] - casualties_loser)
        winner["population"] = max(0.0, winner["population"] - casualties_winner)
        loser["stability"] = clamp(loser["stability"] - 0.02 * dt)
        war["wearinessA"] = clamp(war["wearinessA"] + 0.03 * dt)
        war["wearinessB"] = clamp(war["wearinessB"] + 0.035 * dt)

        captured = None
        loser_cells = [cid for cid in war["fronts"] if cells[cid]["owner"] == loser["id"]]
        if loser_cells and rng.chance(prob_dt(0.4, dt)):
            captured = rng.choice(loser_cells)
            cells[captured]["owner"] = winner["id"]
            city_id = cells[captured]["cityId"]
            if city_id and city_id in state["cities"]:
                city = state["cities"][city_id]
                city["civId"] = winner["id"]
                if city_id in loser["cities"]:
                    loser["cities"].remove(city_id)
                winner["cities"].append(city_id)
                log.emit(tick, CITY_CAPTURED, importance=4, cell_id=captured,
                         civ_ids=[winner["id"], loser["id"]],
                         payload={"city": city["name"], "war": war["id"],
                                  "reason": "war_conquest"})
            else:
                log.emit(tick, TERRITORY_CHANGED, importance=2, cell_id=captured,
                         civ_ids=[winner["id"], loser["id"]],
                         payload={"reason": "war", "war": war["id"]})
            # refugees flee the captured region
            refugees = int(casualties_loser * 6) + 30
            haven = _nearest_safe_cell(state, captured, loser["id"])
            if haven is not None:
                state["migrations"].append({
                    "id": f"mig_{len(state['migrations'])}", "civId": loser["id"],
                    "fromCell": captured, "toCell": haven, "size": refugees, "tick": tick,
                })
                log.emit(tick, MIGRATION_STARTED, importance=2, cell_id=haven,
                         civ_ids=[loser["id"]], cause_event_id=None,
                         payload={"size": refugees, "reason": "war_refugees", "war": war["id"]})

        loser["military"] = max(10.0, loser["military"] * (1.0 - 0.01 * dt))
        winner["military"] = max(10.0, winner["military"] * (1.0 - 0.006 * dt))

        loser_territory = sum(1 for c in cells if c["owner"] == loser["id"])
        lost_major = loser_territory <= 1
        exhausted = war["wearinessA"] > 0.85 or war["wearinessB"] > 0.9
        long_war = tick - war["startTick"] > 40 * dt
        if lost_major or exhausted or long_war:
            _end_war(state, war, atk, dfn, winner, log, tick, conquered=lost_major)


def _end_war(state: dict[str, Any], war: dict[str, Any], atk: dict[str, Any], dfn: dict[str, Any],
             winner: dict[str, Any], log: EventLog, tick: int, conquered: bool) -> None:
    war["active"] = False
    loser = dfn if winner["id"] == atk["id"] else atk
    relationship(state, atk["id"], dfn["id"])["atWar"] = False
    relationship(state, dfn["id"], atk["id"])["atWar"] = False
    relationship(state, winner["id"], loser["id"])["grievances"] += 1
    loser["treasury"] = max(0.0, loser["treasury"] - 40.0)
    winner["treasury"] += 30.0
    winner["happiness"] = clamp(winner["happiness"] + 0.05)
    if conquered and not loser["cities"]:
        loser["extinct"] = True
        log.emit(tick, "CIVILIZATION_COLLAPSED", importance=5, civ_ids=[loser["id"], winner["id"]],
                 payload={"name": loser["name"], "cause": "conquest", "conqueror": winner["name"]})
    log.emit(tick, WAR_ENDED, importance=4, civ_ids=[atk["id"], dfn["id"]],
             payload={"war": war["id"], "winner": winner["name"],
                      "durationYears": tick - war["startTick"],
                      "result": "conquest" if conquered else "treaty"})


# ---------------------------------------------------------------------

def _war_strength(state: dict[str, Any], civ: dict[str, Any], fronts: list[int], rng: Rng, attacking: bool) -> float:
    bonuses = civ_bonuses(state, civ)
    morale = 0.6 + civ["stability"] * 0.4
    terrain = 1.0
    if not attacking and fronts:
        mountainish = sum(1 for cid in fronts if state["cells"][cid]["biome"] in (B.MOUNTAIN, B.VOLCANIC, B.SWAMP))
        terrain += 0.15 * (mountainish / len(fronts))
    supply = 1.0 / (1.0 + len(fronts) * 0.02)
    luck = rng.uniform(0.9, 1.1)
    return civ["military"] * bonuses["military"] * morale * terrain * supply * luck


def _borders(state: dict[str, Any], a: str, b: str) -> bool:
    grid = grid_of(state)
    cells = state["cells"]
    for cell in cells:
        if cell["owner"] == a:
            for nb in grid.neighbors(cell["id"], diagonal=True):
                if cells[nb]["owner"] == b:
                    return True
    return False


def _border_cells(state: dict[str, Any], a: str, b: str) -> list[int]:
    grid = grid_of(state)
    cells = state["cells"]
    out: set[int] = set()
    for cell in cells:
        if cell["owner"] == a:
            for nb in grid.neighbors(cell["id"], diagonal=True):
                if cells[nb]["owner"] == b:
                    out.add(cell["id"])
                    out.add(nb)
    return sorted(out)


def _nearest_safe_cell(state: dict[str, Any], origin: int, civ_id: str) -> int | None:
    grid = grid_of(state)
    cells = state["cells"]
    best = None
    best_d = float("inf")
    for cell in cells:
        if cell["owner"] == civ_id and cell["biome"] in B.LAND_BIOMES:
            d = grid.distance_cells(origin, cell["id"])
            if d < best_d:
                best, best_d = cell["id"], d
    return best


def _allied(state: dict[str, Any], civ_id: str) -> bool:
    return any(al["active"] and civ_id in al["members"] for al in state["alliances"].values())


def _resource_overlap(state: dict[str, Any], a: str, b: str) -> float:
    cells = state["cells"]
    needs_a = {rid for c in cells if c["owner"] == a for rid in c["deposits"]}
    needs_b = {rid for c in cells if c["owner"] == b for rid in c["deposits"]}
    scarce = {"iron", "copper", "gold", "oil", "gems"}
    overlap = needs_a & needs_b & scarce
    return min(1.0, len(overlap) / 2.0)


def _remember(state: dict[str, Any], civ_id: str, note: str) -> None:
    civ = state["civilizations"].get(civ_id)
    if civ is None:
        return
    civ["memory"].append(note)
    if len(civ["memory"]) > 40:
        civ["memory"] = civ["memory"][-40:]
