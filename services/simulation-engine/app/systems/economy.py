"""Economy: supply/demand driven trade routes between cities.

Routes are pathed with Dijkstra over the terrain cost graph (desert,
mountains and war zones cost more; oceans block caravans until
navigation tech). Routes generate income, spread culture/tech and can
carry disease.
"""
from __future__ import annotations

import heapq
from typing import Any

from .. import biomes as B
from ..common import alive_civs, clamp, grid_of, relationship
from ..events import TRADE_ROUTE_CREATED, EventLog
from ..rng import Rng

MAX_ROUTES_PER_TICK = 3
ROUTE_TTL = 400


def dijkstra_path(state: dict[str, Any], start: int, goal: int, allow_sea: bool) -> list[int] | None:
    grid = grid_of(state)
    cells = state["cells"]
    dist = {start: 0.0}
    prev: dict[int, int] = {}
    pq: list[tuple[float, int]] = [(0.0, start)]
    visited: set[int] = set()
    while pq:
        d, cur = heapq.heappop(pq)
        if cur == goal:
            path = [cur]
            while cur in prev:
                cur = prev[cur]
                path.append(cur)
            return list(reversed(path))
        if cur in visited:
            continue
        visited.add(cur)
        for nb in grid.neighbors(cur, diagonal=True):
            cell = cells[nb]
            biome = cell["biome"]
            if biome in B.WATER_BIOMES:
                if not allow_sea or biome != B.COAST:
                    continue
            cost = B.TERRAIN_COST.get(biome, 2.0)
            # active war zones are risky and expensive
            for war in state["wars"].values():
                if war["active"] and nb in war.get("fronts", []):
                    cost *= 4.0
            nd = d + cost
            if nd < dist.get(nb, float("inf")):
                dist[nb] = nd
                prev[nb] = cur
                heapq.heappush(pq, (nd, nb))
    return None


def apply_economy(state: dict[str, Any]) -> None:
    meta = state["meta"]
    tick = meta["tick"]
    dt = meta["yearsPerTick"]
    rng = Rng(meta["seed"], "economy", tick)
    log = EventLog(state)

    _maybe_create_routes(state, rng, log, tick)
    _run_routes(state, log, dt, tick)


def _maybe_create_routes(state: dict[str, Any], rng: Rng, log: EventLog, tick: int) -> None:
    created = 0
    civs = list(alive_civs(state))
    for civ in civs:
        if created >= MAX_ROUTES_PER_TICK:
            break
        for other in civs:
            if created >= MAX_ROUTES_PER_TICK:
                break
            if other["id"] <= civ["id"]:
                continue
            rel = relationship(state, civ["id"], other["id"])
            if not rel.get("trade") or rel["atWar"]:
                continue
            existing = [
                r for r in state["tradeRoutes"].values()
                if r["active"] and {r["civA"], r["civB"]} == {civ["id"], other["id"]}
            ]
            if existing:
                continue
            city_a = _best_port_city(state, civ)
            city_b = _best_port_city(state, other)
            if not city_a or not city_b:
                continue
            allow_sea = any(
                t["tier"] >= 2 for t in state["technologies"].values()
                if t["discoveredBy"] in (civ["id"], other["id"])
            )
            path = dijkstra_path(state, city_a["cellId"], city_b["cellId"], allow_sea)
            if not path or len(path) > 80:
                continue
            commodity = _pick_commodity(state, civ, other, rng)
            rid = f"tr_{len(state['tradeRoutes'])}"
            state["tradeRoutes"][rid] = {
                "id": rid, "civA": civ["id"], "civB": other["id"],
                "cityA": city_a["id"], "cityB": city_b["id"],
                "commodity": commodity, "path": path, "volume": 1.0,
                "createdTick": tick, "active": True,
            }
            created += 1
            log.emit(tick, TRADE_ROUTE_CREATED, importance=2,
                     civ_ids=[civ["id"], other["id"]],
                     payload={"commodity": commodity, "from": city_a["name"], "to": city_b["name"],
                              "pathLength": len(path), "reason": "complementary_trade"})


def _best_port_city(state: dict[str, Any], civ: dict[str, Any]) -> dict[str, Any] | None:
    cities = [state["cities"][cid] for cid in civ["cities"] if cid in state["cities"]]
    if not cities:
        return None
    return max(cities, key=lambda c: c["population"])


def _pick_commodity(state: dict[str, Any], a: dict[str, Any], b: dict[str, Any], rng: Rng) -> str:
    a_surplus = {k: v for k, v in a["stockpiles"].items() if v > 5}
    if a_surplus:
        return max(a_surplus.items(), key=lambda kv: kv[1])[0]
    return rng.choice(["grain", "timber", "tools", "textiles", "salt"])


def _run_routes(state: dict[str, Any], log: EventLog, dt: float, tick: int) -> None:
    for route in list(state["tradeRoutes"].values()):
        if not route["active"]:
            continue
        a = state["civilizations"].get(route["civA"])
        b = state["civilizations"].get(route["civB"])
        if not a or not b or a["extinct"] or b["extinct"]:
            route["active"] = False
            continue
        rel = relationship(state, route["civA"], route["civB"])
        if rel["atWar"]:
            route["active"] = False
            continue
        income = route["volume"] * (2.0 + len(route["path"]) * 0.05)
        a["treasury"] += income * dt * 0.5
        b["treasury"] += income * dt * 0.5
        a["happiness"] = clamp(a["happiness"] + 0.001 * dt)
        b["happiness"] = clamp(b["happiness"] + 0.001 * dt)
        # slow tech diffusion along routes
        if tick - route["createdTick"] > ROUTE_TTL:
            route["active"] = False
