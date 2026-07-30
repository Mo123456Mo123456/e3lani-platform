"""Seeded 2D simplex noise, fBm, ridged noise and Worley (F1) noise.

Pure Python, no dependencies; identical output for identical seeds on any
platform (uses only integer arithmetic for permutation and double math in
a fixed operation order).
"""
from __future__ import annotations

import math

from .rng import Rng

_GRAD2 = (
    (1.0, 1.0), (-1.0, 1.0), (1.0, -1.0), (-1.0, -1.0),
    (1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0),
)
_F2 = 0.5 * (math.sqrt(3.0) - 1.0)
_G2 = (3.0 - math.sqrt(3.0)) / 6.0


class SimplexNoise:
    def __init__(self, seed: int, stream: str = "simplex") -> None:
        rng = Rng(seed, "noise", stream)
        perm = list(range(256))
        rng.shuffle(perm)
        self._perm = perm * 2

    def noise2(self, xin: float, yin: float) -> float:
        perm = self._perm
        s = (xin + yin) * _F2
        i = math.floor(xin + s)
        j = math.floor(yin + s)
        t = (i + j) * _G2
        x0 = xin - (i - t)
        y0 = yin - (j - t)
        if x0 > y0:
            i1, j1 = 1, 0
        else:
            i1, j1 = 0, 1
        x1 = x0 - i1 + _G2
        y1 = y0 - j1 + _G2
        x2 = x0 - 1.0 + 2.0 * _G2
        y2 = y0 - 1.0 + 2.0 * _G2
        ii = i & 255
        jj = j & 255
        n = 0.0

        t0 = 0.5 - x0 * x0 - y0 * y0
        if t0 > 0:
            g = _GRAD2[perm[ii + perm[jj]] & 7]
            t0 *= t0
            n += t0 * t0 * (g[0] * x0 + g[1] * y0)

        t1 = 0.5 - x1 * x1 - y1 * y1
        if t1 > 0:
            g = _GRAD2[perm[ii + i1 + perm[jj + j1]] & 7]
            t1 *= t1
            n += t1 * t1 * (g[0] * x1 + g[1] * y1)

        t2 = 0.5 - x2 * x2 - y2 * y2
        if t2 > 0:
            g = _GRAD2[perm[ii + 1 + perm[jj + 1]] & 7]
            t2 *= t2
            n += t2 * t2 * (g[0] * x2 + g[1] * y2)

        return 70.0 * n  # ~[-1, 1]

    def fbm(self, x: float, y: float, octaves: int = 5, lacunarity: float = 2.0, gain: float = 0.5) -> float:
        amp = 1.0
        freq = 1.0
        total = 0.0
        norm = 0.0
        for _ in range(octaves):
            total += amp * self.noise2(x * freq, y * freq)
            norm += amp
            amp *= gain
            freq *= lacunarity
        return total / norm if norm else 0.0

    def ridged(self, x: float, y: float, octaves: int = 4, lacunarity: float = 2.0, gain: float = 0.5) -> float:
        amp = 0.5
        freq = 1.0
        total = 0.0
        norm = 0.0
        for _ in range(octaves):
            total += amp * (1.0 - abs(self.noise2(x * freq, y * freq)))
            norm += amp
            amp *= gain
            freq *= lacunarity
        return total / norm if norm else 0.0


class WorleyNoise:
    """F1 Worley noise on a jittered integer lattice, in [0, ~1]."""

    def __init__(self, seed: int, stream: str = "worley", density: float = 1.0) -> None:
        self.seed = seed
        self.stream = stream
        self.density = max(1, int(density))

    def _point(self, cx: int, cy: int) -> tuple[float, float]:
        rng = Rng(self.seed, "worley", self.stream, cx, cy)
        return cx + rng.random(), cy + rng.random()

    def f1(self, x: float, y: float) -> float:
        xi = math.floor(x)
        yi = math.floor(y)
        best = float("inf")
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                px, py = self._point(xi + dx, yi + dy)
                d = (px - x) ** 2 + (py - y) ** 2
                if d < best:
                    best = d
        return min(1.0, math.sqrt(best))
