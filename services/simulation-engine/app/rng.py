"""Seeded RNG — bit-exact Python port of packages/simulation-models/src/rng.ts.

Cross-language determinism is enforced by tests: xmur3 + mulberry32 produce
the identical sequence in TypeScript and Python, so scenario branches are
reproducible across service boundaries.
"""
from __future__ import annotations


def xmur3(text: str) -> int:
    h = (1779033703 ^ len(text)) & 0xFFFFFFFF
    for ch in text:
        h = _imul(h ^ ord(ch), 3432918353)
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF
    h = _imul(h ^ (h >> 16), 2246822507)
    h = _imul(h ^ (h >> 13), 3266489909)
    return (h ^ (h >> 16)) & 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """Math.imul semantics: 32-bit signed multiplication."""
    result = (a * b) & 0xFFFFFFFF
    return result


class Mulberry32:
    def __init__(self, seed: int):
        self.seed = seed & 0xFFFFFFFF
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.state
        t = _imul(t ^ (t >> 15), t | 1)
        t = (t ^ (t + _imul(t ^ (t >> 7), t | 61))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    def range(self, lo: float, hi: float) -> float:
        return lo + self.next() * (hi - lo)

    def chance(self, p: float) -> bool:
        return self.next() < p

    def fork(self, label: str) -> "Mulberry32":
        return Mulberry32(xmur3(f"{self.seed}:{label}:{self.state}"))


def rng_from_string(seed: str) -> Mulberry32:
    return Mulberry32(xmur3(seed))
