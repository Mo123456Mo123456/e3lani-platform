"""Deterministic seeded RNG.

One root seed drives the whole world. Each (tick, system, purpose) tuple
derives an independent stream via BLAKE2b, so results never depend on
Python dict ordering or call scheduling.
"""
from __future__ import annotations

import hashlib
import random
from typing import Sequence, TypeVar

T = TypeVar("T")


def derive_seed(root: int, *parts: object) -> int:
    h = hashlib.blake2b(digest_size=8)
    h.update(str(int(root)).encode())
    for p in parts:
        h.update(b"|")
        h.update(str(p).encode())
    return int.from_bytes(h.digest(), "big")


class Rng:
    """A single deterministic random stream."""

    __slots__ = ("seed", "_r")

    def __init__(self, root_seed: int, *stream: object) -> None:
        self.seed = derive_seed(root_seed, *stream)
        self._r = random.Random(self.seed)

    def random(self) -> float:
        return self._r.random()

    def uniform(self, a: float = 0.0, b: float = 1.0) -> float:
        return self._r.uniform(a, b)

    def randint(self, a: int, b: int) -> int:
        return self._r.randint(a, b)

    def chance(self, p: float) -> bool:
        if p <= 0.0:
            return False
        if p >= 1.0:
            return True
        return self._r.random() < p

    def choice(self, seq: Sequence[T]) -> T:
        return seq[self._r.randrange(len(seq))]

    def shuffle(self, lst: list) -> None:
        self._r.shuffle(lst)

    def gauss(self, mu: float, sigma: float) -> float:
        return self._r.gauss(mu, sigma)

    def weighted(self, items: Sequence[tuple[T, float]]) -> T:
        total = sum(w for _, w in items)
        if total <= 0:
            return items[0][0]
        roll = self._r.random() * total
        acc = 0.0
        for item, w in items:
            acc += w
            if roll <= acc:
                return item
        return items[-1][0]

    def sample(self, seq: Sequence[T], k: int) -> list[T]:
        k = min(k, len(seq))
        return self._r.sample(list(seq), k)


def hash_state(obj: object) -> str:
    """Stable SHA-256 of any JSON-serialisable structure."""
    import json

    blob = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode()).hexdigest()
