"""Spherical lat/lon cell grid.

Equirectangular cells map 1:1 onto globe UV space, so every computed
layer (biome, temperature, politics...) can be rendered as a texture
without reprojection. East/west wrap; poles clamp.
"""
from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass

_NB_CACHE: dict[tuple[int, int, int, bool], tuple[int, ...]] = {}


@dataclass(frozen=True)
class Grid:
    lat_bands: int
    lon_bands: int

    @property
    def size(self) -> int:
        return self.lat_bands * self.lon_bands

    def cell_id(self, lat_i: int, lon_i: int) -> int:
        return lat_i * self.lon_bands + (lon_i % self.lon_bands)

    def lat_i(self, cid: int) -> int:
        return cid // self.lon_bands

    def lon_i(self, cid: int) -> int:
        return cid % self.lon_bands

    def lat_deg(self, cid: int) -> float:
        return -90.0 + (self.lat_i(cid) + 0.5) * (180.0 / self.lat_bands)

    def lon_deg(self, cid: int) -> float:
        return -180.0 + (self.lon_i(cid) + 0.5) * (360.0 / self.lon_bands)

    def from_latlon(self, lat: float, lon: float) -> int:
        lat_i = min(self.lat_bands - 1, max(0, int((lat + 90.0) / (180.0 / self.lat_bands))))
        lon_i = int(((lon + 180.0) % 360.0) / (360.0 / self.lon_bands))
        return self.cell_id(lat_i, lon_i)

    def area_weight(self, cid: int) -> float:
        """Relative surface area of the cell (1.0 at the equator)."""
        return max(0.05, math.cos(math.radians(self.lat_deg(cid))))

    def neighbors(self, cid: int, diagonal: bool = False) -> list[int]:
        key = (self.lat_bands, self.lon_bands, cid, diagonal)
        cached = _NB_CACHE.get(key)
        if cached is not None:
            return list(cached)
        lat_i = self.lat_i(cid)
        lon_i = self.lon_i(cid)
        out: list[int] = []
        steps = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        if diagonal:
            steps += [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        for dlat, dlon in steps:
            la = lat_i + dlat
            if la < 0 or la >= self.lat_bands:
                continue
            out.append(self.cell_id(la, lon_i + dlon))
        if len(_NB_CACHE) < 2_000_000:
            _NB_CACHE[key] = tuple(out)
        return out

    def distance_cells(self, a: int, b: int) -> float:
        """Great-circle-ish distance in cell units."""
        lat1, lon1 = math.radians(self.lat_deg(a)), math.radians(self.lon_deg(a))
        lat2, lon2 = math.radians(self.lat_deg(b)), math.radians(self.lon_deg(b))
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        ang = 2 * math.asin(min(1.0, math.sqrt(h)))
        return ang / math.pi * max(self.lat_bands, self.lon_bands / 2)


def bfs_distance(grid: Grid, sources: list[int], passable) -> list[float]:
    """Multi-source BFS distance (in cell hops); inf where unreachable."""
    dist = [float("inf")] * grid.size
    dq: deque[int] = deque()
    for s in sources:
        if passable(s):
            dist[s] = 0.0
            dq.append(s)
    while dq:
        cur = dq.popleft()
        for nb in grid.neighbors(cur):
            if passable(nb) and dist[nb] == float("inf"):
                dist[nb] = dist[cur] + 1
                dq.append(nb)
    return dist
