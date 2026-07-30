"""Supply/demand markets and Dijkstra trade-path routing."""

from __future__ import annotations

import heapq
from typing import Any

from .rng import SeededRNG


def update_markets(
    markets: dict[str, dict[str, float]],
    *,
    producers: float,
    population_total: float,
    injected_traits: list[dict[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, float]], list[dict[str, Any]]]:
    """Adjust supply/demand/prices; return events for significant shocks."""
    events: list[dict[str, Any]] = []
    updated: dict[str, dict[str, float]] = {}

    supply_mod = 1.0
    demand_mod = 1.0
    for inj in injected_traits or []:
        traits = inj.get("traits") or {}
        supply_mod += float(traits.get("productivity", 0.0)) * 0.2
        demand_mod += float(traits.get("luxury", 0.0)) * 0.15
        events.append(
            {
                "type": "economy.injection_effect",
                "cause": f"element:{inj.get('name', 'unknown')}",
                "effect": {
                    "supply_mod": supply_mod,
                    "demand_mod": demand_mod,
                },
            }
        )

    for good, m in markets.items():
        supply = float(m.get("supply", 50.0))
        demand = float(m.get("demand", 50.0))
        price = float(m.get("price", 1.0))

        if good == "food":
            supply = supply * 0.9 + producers * 0.5 * supply_mod
            demand = demand * 0.9 + population_total * 0.15 * demand_mod
        elif good == "energy":
            supply = supply * 0.95 * supply_mod
            demand = demand * 0.9 + population_total * 0.1 * demand_mod
        else:
            supply = supply * 0.95 * supply_mod
            demand = demand * 0.95 * demand_mod

        # Price discovery toward equilibrium
        ratio = demand / max(supply, 1e-6)
        price = max(0.1, price * (0.7 + 0.3 * ratio))

        updated[good] = {"supply": supply, "demand": demand, "price": price}
        if ratio > 1.5:
            events.append(
                {
                    "type": "economy.shortage",
                    "cause": f"demand_exceeds_supply:{good}",
                    "effect": {"good": good, "ratio": ratio, "price": price},
                }
            )
        elif ratio < 0.6:
            events.append(
                {
                    "type": "economy.surplus",
                    "cause": f"supply_exceeds_demand:{good}",
                    "effect": {"good": good, "ratio": ratio, "price": price},
                }
            )

    return updated, events


def dijkstra_trade_path(
    width: int,
    height: int,
    start: tuple[int, int],
    goal: tuple[int, int],
    *,
    pollution: Any = None,
    biomes: list[list[str]] | None = None,
) -> tuple[list[tuple[int, int]], float]:
    """Shortest trade path with terrain/pollution costs."""

    def cost(y: int, x: int) -> float:
        c = 1.0
        if biomes is not None:
            b = biomes[y][x]
            if b == "ocean":
                c += 3.0
            elif b == "mountain":
                c += 2.0
            elif b == "desert":
                c += 1.2
            elif b == "swamp":
                c += 1.5
        if pollution is not None:
            c += float(pollution[y, x]) * 2.0
        return c

    sy, sx = start
    gy, gx = goal
    dist = {(sy, sx): 0.0}
    prev: dict[tuple[int, int], tuple[int, int] | None] = {(sy, sx): None}
    pq: list[tuple[float, int, int]] = [(0.0, sy, sx)]
    visited: set[tuple[int, int]] = set()

    while pq:
        d, y, x = heapq.heappop(pq)
        if (y, x) in visited:
            continue
        visited.add((y, x))
        if (y, x) == (gy, gx):
            break
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if not (0 <= ny < height and 0 <= nx < width):
                continue
            nd = d + cost(ny, nx)
            if nd < dist.get((ny, nx), float("inf")):
                dist[(ny, nx)] = nd
                prev[(ny, nx)] = (y, x)
                heapq.heappush(pq, (nd, ny, nx))

    if (gy, gx) not in dist:
        return [], float("inf")

    path: list[tuple[int, int]] = []
    cur: tuple[int, int] | None = (gy, gx)
    while cur is not None:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()
    return path, dist[(gy, gx)]


def step_trade_routes(
    civs: list[dict[str, Any]],
    *,
    width: int,
    height: int,
    pollution: Any,
    biomes: list[list[str]],
    rng: SeededRNG,
) -> list[dict[str, Any]]:
    """Compute trade paths between a random pair of civs each tick."""
    events: list[dict[str, Any]] = []
    if len(civs) < 2:
        return events
    i = rng.randint(0, len(civs) - 1)
    j = rng.randint(0, len(civs) - 1)
    if i == j:
        j = (j + 1) % len(civs)
    a, b = civs[i], civs[j]
    path, total_cost = dijkstra_trade_path(
        width,
        height,
        (int(a["y"]), int(a["x"])),
        (int(b["y"]), int(b["x"])),
        pollution=pollution,
        biomes=biomes,
    )
    events.append(
        {
            "type": "economy.trade_route",
            "cause": f"trade:{a['id']}->{b['id']}",
            "effect": {
                "from": a["id"],
                "to": b["id"],
                "path_len": len(path),
                "cost": total_cost,
            },
        }
    )
    return events
