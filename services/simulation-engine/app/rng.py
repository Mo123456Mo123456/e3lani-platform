"""Seeded deterministic random number generator."""

from __future__ import annotations

import hashlib
import struct
from typing import Sequence


class SeededRNG:
    """Deterministic PRNG derived from a 64-bit seed (xorshift64*).

    Same seed always yields the same sequence. Sub-streams can be derived
    via ``derive(label)`` so subsystems stay independent yet reproducible.
    """

    __slots__ = ("_state",)

    def __init__(self, seed: int | str) -> None:
        if isinstance(seed, str):
            digest = hashlib.sha256(seed.encode("utf-8")).digest()
            seed = struct.unpack(">Q", digest[:8])[0]
        self._state = (int(seed) & 0xFFFFFFFFFFFFFFFF) or 0xDEADBEEFCAFEBABE

    def derive(self, label: str) -> "SeededRNG":
        material = f"{self._state}:{label}".encode("utf-8")
        digest = hashlib.sha256(material).digest()
        child = struct.unpack(">Q", digest[:8])[0]
        return SeededRNG(child)

    def next_u64(self) -> int:
        x = self._state
        x ^= (x >> 12) & 0xFFFFFFFFFFFFFFFF
        x ^= (x << 25) & 0xFFFFFFFFFFFFFFFF
        x ^= (x >> 27) & 0xFFFFFFFFFFFFFFFF
        self._state = x & 0xFFFFFFFFFFFFFFFF
        return (x * 0x2545F4914F6CDD1D) & 0xFFFFFFFFFFFFFFFF

    def random(self) -> float:
        """Uniform float in [0, 1)."""
        return (self.next_u64() >> 11) * (1.0 / (1 << 53))

    def uniform(self, low: float = 0.0, high: float = 1.0) -> float:
        return low + (high - low) * self.random()

    def randint(self, low: int, high: int) -> int:
        """Inclusive integer range [low, high]."""
        if high < low:
            raise ValueError("high must be >= low")
        span = high - low + 1
        return low + int(self.next_u64() % span)

    def choice(self, seq: Sequence):
        if not seq:
            raise IndexError("Cannot choose from empty sequence")
        return seq[self.randint(0, len(seq) - 1)]

    def gauss(self, mu: float = 0.0, sigma: float = 1.0) -> float:
        """Box-Muller transform (consumes two uniforms)."""
        u1 = max(self.random(), 1e-12)
        u2 = self.random()
        import math

        z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        return mu + sigma * z

    def shuffle(self, items: list) -> None:
        for i in range(len(items) - 1, 0, -1):
            j = self.randint(0, i)
            items[i], items[j] = items[j], items[i]
