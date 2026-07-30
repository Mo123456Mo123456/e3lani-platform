"""Placement helpers for injection."""
from __future__ import annotations

from typing import Any, Callable

from . import biomes as B
from .grid import Grid
from .rng import Rng


def best_cells_for(
    state: dict[str, Any],
    fit: Callable[[dict[str, Any]], float],
    *,
    around: int | None,
    count: int,
    rng: Rng,
    min_fit: float = 0.25,
) -> list[int]:
    """Pick the best cells by fitness; when ``around`` is given, search
    its neighbourhood first (user-chosen region), else global top-N."""
    grid = Grid(state["grid"]["latBands"], state["grid"]["lonBands"])
    cells = state["cells"]

    if around is not None and 0 <= int(around) < len(cells):
        region = {int(around)}
        frontier = [int(around)]
        for _ in range(3):
            nxt: list[int] = []
            for c in frontier:
                for nb in grid.neighbors(c, diagonal=True):
                    if nb not in region:
                        region.add(nb)
                        nxt.append(nb)
            frontier = nxt
        scored = sorted(
            ((fit(cells[c]), c) for c in region if B.is_land(cells[c]["biome"])),
            key=lambda kv: -kv[0],
        )
        picked = [c for f, c in scored if f >= min_fit][:count]
        if picked:
            return picked

    scored_all = sorted(
        ((fit(c), c["id"]) for c in cells if B.is_land(c["biome"])),
        key=lambda kv: -kv[0],
    )
    picked = []
    for f, cid in scored_all:
        if f < min_fit:
            break
        if all(grid.distance_cells(cid, p) > 1 for p in picked):
            picked.append(cid)
        if len(picked) >= count:
            break
    if not picked and scored_all:
        picked = [scored_all[0][1]]
    return picked
