from __future__ import annotations

import hashlib
from collections.abc import Sequence
from typing import TypeVar

import numpy as np

T = TypeVar("T")


def seed_to_int(seed: str | int, namespace: str = "") -> int:
    raw = f"{namespace}:{seed}".encode("utf-8")
    return int.from_bytes(hashlib.sha256(raw).digest()[:8], "big", signed=False)


class SeededRNG:
    """Small deterministic wrapper around NumPy PCG64 substreams."""

    def __init__(self, seed: str | int, namespace: str = "root") -> None:
        self.seed = str(seed)
        self.namespace = namespace
        self._rng = np.random.default_rng(seed_to_int(self.seed, namespace))

    def stream(self, namespace: str) -> "SeededRNG":
        return SeededRNG(self.seed, f"{self.namespace}/{namespace}")

    def random(self) -> float:
        return float(self._rng.random())

    def uniform(self, low: float = 0.0, high: float = 1.0) -> float:
        return float(self._rng.uniform(low, high))

    def normal(self, mean: float = 0.0, std: float = 1.0) -> float:
        return float(self._rng.normal(mean, std))

    def integers(self, low: int, high: int | None = None) -> int:
        return int(self._rng.integers(low, high))

    def choice(self, values: Sequence[T]) -> T:
        if not values:
            raise ValueError("cannot choose from an empty sequence")
        return values[self.integers(0, len(values))]

    def weighted_choice(self, values: Sequence[T], weights: Sequence[float]) -> T:
        if len(values) != len(weights) or not values:
            raise ValueError("values and weights must have equal non-zero length")
        arr = np.array([max(0.0, float(w)) for w in weights], dtype=float)
        if arr.sum() <= 0:
            return self.choice(values)
        idx = int(self._rng.choice(len(values), p=arr / arr.sum()))
        return values[idx]

    def shuffled(self, values: Sequence[T]) -> list[T]:
        idxs = list(range(len(values)))
        self._rng.shuffle(idxs)
        return [values[i] for i in idxs]

    def matrix(self, shape: tuple[int, ...]) -> np.ndarray:
        return self._rng.random(shape)


def stable_id(prefix: str, *parts: object, length: int = 16) -> str:
    raw = "|".join(str(p) for p in parts).encode("utf-8")
    return f"{prefix}_{hashlib.sha256(raw).hexdigest()[:length]}"

