"""Technology progression: research unlocks higher tiers, knowledge
diffuses to trade partners, and culture slowly drifts."""
from __future__ import annotations

from typing import Any

from ..common import alive_civs, prob_dt
from ..events import CULTURE_EVOLVED, TECHNOLOGY_DISCOVERED, EventLog
from ..names import tech_name
from ..rng import Rng

TIER_THRESHOLDS = {2: 60.0, 3: 160.0, 4: 340.0, 5: 620.0}


def apply_technology(state: dict[str, Any]) -> None:
    meta = state["meta"]
    tick = meta["tick"]
    dt = meta["yearsPerTick"]
    rng = Rng(meta["seed"], "tech", tick)
    log = EventLog(state)

    for civ in alive_civs(state):
        next_tier = civ["techLevel"] + 1
        threshold = TIER_THRESHOLDS.get(next_tier)
        if threshold and civ["techProgress"] >= threshold:
            civ["techLevel"] = next_tier
            civ["techProgress"] = 0.0
            tid = f"tech_{len(state['technologies'])}"
            name = tech_name(rng, min(next_tier - 1, 5))
            state["technologies"][tid] = {
                "id": tid, "name": name, "tier": min(next_tier - 1, 5),
                "discoveredBy": civ["id"], "tick": tick,
            }
            civ["education"] = min(1.0, civ["education"] + 0.08)
            log.emit(tick, TECHNOLOGY_DISCOVERED, importance=3, civ_ids=[civ["id"]],
                     payload={"tech": name, "tier": next_tier, "civ": civ["name"],
                              "cause": "research_progress"})

    # diffusion along active trade routes
    for route in state["tradeRoutes"].values():
        if not route["active"]:
            continue
        a = state["civilizations"].get(route["civA"])
        b = state["civilizations"].get(route["civB"])
        if not a or not b or a["extinct"] or b["extinct"]:
            continue
        if a["techLevel"] > b["techLevel"] and rng.chance(prob_dt(0.06, dt)):
            b["techProgress"] += 25.0
        elif b["techLevel"] > a["techLevel"] and rng.chance(prob_dt(0.06, dt)):
            a["techProgress"] += 25.0

    # cultural drift
    for civ in alive_civs(state):
        if rng.chance(prob_dt(0.004, dt)):
            log.emit(tick, CULTURE_EVOLVED, importance=1, civ_ids=[civ["id"]],
                     payload={"culture": civ["culture"], "driver": "drift"})
