"""Value noise and fractional Brownian motion for planetary terrain."""

from __future__ import annotations

import math
from typing import Callable

import numpy as np

from .rng import SeededRNG


def _fade(t: float) -> float:
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def _lerp(a: float, b: float, t: float) -> float:
    return a + t * (b - a)


class ValueNoise2D:
    """Smooth value noise on a hashed lattice (deterministic for a seed)."""

    def __init__(self, rng: SeededRNG, table_size: int = 256) -> None:
        self.size = table_size
        self.values = np.array(
            [rng.uniform(-1.0, 1.0) for _ in range(table_size * table_size)],
            dtype=np.float64,
        ).reshape(table_size, table_size)

    def _hash(self, ix: int, iy: int) -> float:
        return float(self.values[ix % self.size, iy % self.size])

    def noise(self, x: float, y: float) -> float:
        x0 = math.floor(x)
        y0 = math.floor(y)
        fx = x - x0
        fy = y - y0
        u = _fade(fx)
        v = _fade(fy)
        n00 = self._hash(x0, y0)
        n10 = self._hash(x0 + 1, y0)
        n01 = self._hash(x0, y0 + 1)
        n11 = self._hash(x0 + 1, y0 + 1)
        nx0 = _lerp(n00, n10, u)
        nx1 = _lerp(n01, n11, u)
        return _lerp(nx0, nx1, v)


def fbm(
    noise_fn: Callable[[float, float], float],
    x: float,
    y: float,
    *,
    octaves: int = 5,
    lacunarity: float = 2.0,
    gain: float = 0.5,
) -> float:
    """Fractional Brownian motion: layered noise for natural terrain."""
    amp = 1.0
    freq = 1.0
    total = 0.0
    norm = 0.0
    for _ in range(octaves):
        total += amp * noise_fn(x * freq, y * freq)
        norm += amp
        amp *= gain
        freq *= lacunarity
    return total / norm if norm else 0.0


def simplex_like(rng: SeededRNG, width: int, height: int, scale: float = 0.08) -> np.ndarray:
    """Generate a 2D height field via value-noise FBM (simplex-like character)."""
    vn = ValueNoise2D(rng)
    grid = np.zeros((height, width), dtype=np.float64)
    for y in range(height):
        for x in range(width):
            grid[y, x] = fbm(vn.noise, x * scale, y * scale)
    return grid
