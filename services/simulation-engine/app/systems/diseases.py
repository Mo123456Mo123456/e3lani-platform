"""Diseases: outbreaks from density/poor health, spread via adjacency
and trade routes, mortality vs medicine, containment. Blight variant
can hit plant populations in infected regions."""
from __future__ import annotations

from typing import Any

from ..common import alive_civs, clamp, grid_of, prob_dt, territory_of
from ..events import DISEASE_CONTAINED, DISEASE_OUTBREAK, EventLog
from ..rng import Rng


def apply_diseases(state: dict[str, Any]) -> None:
    meta = state["meta"]
    tick = meta["tick"]
    dt = meta["yearsPerTick"]
    rng = Rng(meta["seed"], "disease", tick)
    log = EventLog(state)
    cells = state["cells"]

    # ---- new outbreaks -------------------------------------------------
    for civ in alive_civs(state):
        if civ["population"] < 2500:
            continue
        risk = (civ["population"] / 60000.0) * max(0.2, 1.0 - civ["health"])
        if rng.chance(prob_dt(risk * 0.012, dt)):
            city_id = max(
                (state["cities"][cid] for cid in civ["cities"] if cid in state["cities"]),
                key=lambda c: c["population"], default=None,
            )
            if not city_id:
                continue
            did = f"dis_{len(state['diseases'])}"
            severity = round(rng.uniform(0.15, 0.6), 2)
            state["diseases"][did] = {
                "id": did, "originCity": city_id["id"], "originCell": city_id["cellId"],
                "severity": severity, "transmission": round(rng.uniform(0.2, 0.7), 2),
                "civs": [civ["id"]], "cells": [city_id["cellId"]],
                "startTick": tick, "active": True,
            }
            civ["health"] = clamp(civ["health"] - severity * 0.2)
            log.emit(tick, DISEASE_OUTBREAK, importance=4, cell_id=city_id["cellId"],
                     civ_ids=[civ["id"]],
                     payload={"disease": did, "severity": severity, "city": city_id["name"],
                              "cause": "density_health_risk"})

    # ---- progression ----------------------------------------------------
    for disease in state["diseases"].values():
        if not disease["active"]:
            continue
        infected_civs: set[str] = set(disease["civs"])
        # spread along adjacency
        new_cells: list[int] = []
        for cid in disease["cells"]:
            for nb in grid_of(state).neighbors(cid):
                if nb in disease["cells"] or not rng.chance(prob_dt(disease["transmission"] * 0.25, dt)):
                    continue
                owner = cells[nb]["owner"]
                if owner:
                    new_cells.append(nb)
                    if owner not in infected_civs and owner in state["civilizations"] \
                            and not state["civilizations"][owner]["extinct"]:
                        infected_civs.add(owner)
                        log.emit(tick, DISEASE_OUTBREAK, importance=3, cell_id=nb, civ_ids=[owner],
                                 payload={"disease": disease["id"], "severity": disease["severity"],
                                          "route": "adjacency"})
        # spread along trade routes
        for route in state["tradeRoutes"].values():
            if not route["active"]:
                continue
            pair = {route["civA"], route["civB"]}
            if pair & infected_civs and not pair <= infected_civs:
                if rng.chance(prob_dt(disease["transmission"] * 0.4, dt)):
                    target = (pair - infected_civs).pop()
                    infected_civs.add(target)
                    log.emit(tick, DISEASE_OUTBREAK, importance=3, civ_ids=sorted(pair),
                             payload={"disease": disease["id"], "route": "trade",
                                      "tradeRoute": route["id"]})
        disease["cells"] = sorted(set(disease["cells"]) | set(new_cells))[:120]
        disease["civs"] = sorted(infected_civs)

        # mortality & recovery per infected civ
        for civ_id in infected_civs:
            civ = state["civilizations"].get(civ_id)
            if not civ or civ["extinct"]:
                continue
            mortality = disease["severity"] * max(0.15, 1.1 - civ["health"]) * 0.02
            civ["population"] = max(0.0, civ["population"] * (1.0 - mortality * dt))
            civ["happiness"] = clamp(civ["happiness"] - 0.03 * dt)

        # containment
        age = tick - disease["startTick"]
        avg_health = 0.6
        hosts = [state["civilizations"][c] for c in infected_civs if c in state["civilizations"]]
        if hosts:
            avg_health = sum(c["health"] for c in hosts) / len(hosts)
        if age > 8 and rng.chance(prob_dt(avg_health * 0.25, dt)):
            disease["active"] = False
            log.emit(tick, DISEASE_CONTAINED, importance=3,
                     civ_ids=sorted(infected_civs),
                     payload={"disease": disease["id"], "durationYears": age,
                              "cause": "public_health_recovery"})
