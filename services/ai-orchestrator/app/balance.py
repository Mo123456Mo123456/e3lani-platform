"""Balance validation — Python mirror of packages/simulation-models balance.

Kept algorithmically identical (same weights/budgets/combos) so a
contribution validated here behaves identically in the TS engine.
"""
from __future__ import annotations

from typing import Dict, List, Tuple

from .schemas import BalanceReport, BalanceViolation, Category, StructuredContribution

TRAIT_WEIGHTS: Dict[str, float] = {
    "size": 0.5, "lifespan": 0.8, "reproductionRate": 1.0, "growthRate": 0.9,
    "heatResistance": 0.4, "coldResistance": 0.4, "waterNeed": -0.3,
    "intelligence": 0.9, "aggression": 0.7, "mobility": 0.5, "adaptability": 0.9,
    "mutationRate": 0.6, "pollutionAbsorption": 0.7, "nightLuminosity": 0.3,
    "energyStorage": 0.9, "toxicity": 0.8, "photosynthetic": 0.6, "yield": 0.8,
    "rarity": -0.2, "value": 0.9, "virulence": 0.9, "contagiousness": 0.9,
    "severity": 0.9,
}

CATEGORY_BUDGETS: Dict[Category, float] = {
    Category.creature: 1.6, Category.plant: 1.6, Category.resource: 1.4,
    Category.civilization: 1.5, Category.invention: 1.5, Category.phenomenon: 1.3,
    Category.disease: 1.2, Category.culture: 1.2, Category.law: 1.0,
    Category.custom: 1.2,
}

FORBIDDEN_COMBOS: List[Tuple[List[str], float, str]] = [
    (["reproductionRate", "adaptability", "toxicity"], 2.4,
     "unkillable plague: extreme reproduction + adaptability + toxicity"),
    (["lifespan", "reproductionRate", "adaptability"], 2.6,
     "immortal swarm: cannot die out and spreads without bound"),
    (["energyStorage", "growthRate", "pollutionAbsorption"], 2.7,
     "infinite free energy loop breaks the resource economy"),
]


def power_score(contribution: StructuredContribution) -> float:
    score = 0.0
    for trait, value in contribution.traits.items():
        score += TRAIT_WEIGHTS.get(trait, 0.55) * value
    return round(score, 3)


def validate_balance(contribution: StructuredContribution) -> BalanceReport:
    violations: List[BalanceViolation] = []
    budget = CATEGORY_BUDGETS[contribution.category]
    score = power_score(contribution)
    if score > budget:
        violations.append(BalanceViolation(
            code="POWER_BUDGET_EXCEEDED",
            message=f"power score {score:.2f} exceeds the {contribution.category.value} budget of {budget}",
        ))
    for traits, threshold, message in FORBIDDEN_COMBOS:
        total = sum(contribution.traits.get(t, 0.0) for t in traits)
        if total >= threshold:
            violations.append(BalanceViolation(code="FORBIDDEN_COMBO", message=message))
    maxed = sum(1 for v in contribution.traits.values() if v >= 0.99)
    if maxed > 2:
        violations.append(BalanceViolation(
            code="TRAIT_SATURATION",
            message="more than two traits are at absolute maximum",
        ))
    if not violations:
        return BalanceReport(balanced=True, violations=[], suggested=None, power_score=score)
    return BalanceReport(
        balanced=False,
        violations=violations,
        suggested=build_balanced_suggestion(contribution, budget),
        power_score=score,
    )


def build_balanced_suggestion(contribution: StructuredContribution, budget: float) -> StructuredContribution:
    traits = dict(contribution.traits)

    def score(t: Dict[str, float]) -> float:
        return sum(TRAIT_WEIGHTS.get(k, 0.55) * v for k, v in t.items())

    current = score(traits)
    if current > budget:
        factor = (budget * 0.92) / current
        for key in list(traits):
            if TRAIT_WEIGHTS.get(key, 0.55) <= 0:
                continue
            traits[key] = round(traits[key] * factor, 3)
    for combo, threshold, _ in FORBIDDEN_COMBOS:
        total = sum(traits.get(t, 0.0) for t in combo)
        while total >= threshold:
            weakest = min(combo, key=lambda t: traits.get(t, 0.0))
            traits[weakest] = max(0.1, round(traits.get(weakest, 0.0) - 0.15, 3))
            total = sum(traits.get(t, 0.0) for t in combo)
    return StructuredContribution(
        category=contribution.category,
        name=contribution.name,
        description=contribution.description,
        traits=traits,
        possible_biomes=contribution.possible_biomes,
        risks=[*contribution.risks, "auto-balanced to respect the world's power budget"],
    )
