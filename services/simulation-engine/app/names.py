"""Seeded procedural name generation for civilizations, cities and species."""
from __future__ import annotations

from .rng import Rng

_ONSET = ["k", "t", "s", "m", "n", "r", "l", "d", "z", "v", "sh", "th", "q", "g", "b", "h"]
_NUCLEUS = ["a", "e", "i", "o", "u", "ai", "ia", "ou", "ea"]
_CODA = ["n", "r", "l", "s", "m", "th", "k", "sh", "", "", ""]
_SPECIES_PARTS = [
    ("azor", "vel", "kir", "mor", "tal", "syrr", "bra", "lun", "fer", "qua"),
    ("oth", "is", "ara", "ex", "ion", "ith", "or", "une", "ax", "eel"),
]
_CIV_SUFFIX = ["Empire", "Confederacy", "Dominion", "Tribes", "Republic", "Kingdom", "Union", "Clans"]


def _word(rng: Rng, syllables: int) -> str:
    out = []
    for _ in range(syllables):
        out.append(rng.choice(_ONSET))
        out.append(rng.choice(_NUCLEUS))
        out.append(rng.choice(_CODA))
    return "".join(out)


def civ_name(rng: Rng) -> str:
    base = _word(rng, rng.randint(1, 2)).capitalize()
    return f"{base} {rng.choice(_CIV_SUFFIX)}"


def city_name(rng: Rng) -> str:
    return _word(rng, rng.randint(1, 2)).capitalize()


def species_name(rng: Rng) -> str:
    a = rng.choice(_SPECIES_PARTS[0])
    b = rng.choice(_SPECIES_PARTS[1])
    return f"{a.capitalize()}{b}"


def tech_name(rng: Rng, tier: int) -> str:
    tiers = {
        0: ["Fire Mastery", "Foraging", "Stone Tools", "Herbalism"],
        1: ["Agriculture", "Animal Husbandry", "Pottery", "Irrigation"],
        2: ["Metallurgy", "Writing", "Sailing", "Mathematics"],
        3: ["Engineering", "Medicine", "Printing", "Navigation"],
        4: ["Electricity", "Industrial Chemistry", "Railways", "Flight"],
        5: ["Computing", "Fusion Power", "Gene Editing", "Orbital Industry"],
    }
    return rng.choice(tiers.get(tier, tiers[5]))


def culture_name(rng: Rng) -> str:
    return _word(rng, 2).capitalize() + "i"


def language_name(rng: Rng) -> str:
    return _word(rng, 2).capitalize() + "ian"
