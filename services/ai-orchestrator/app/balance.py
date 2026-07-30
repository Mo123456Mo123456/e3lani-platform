"""Balance layer: keeps the world playable.

Instead of blunt rejection, overpowered ideas are scaled into a
balanced equivalent with an explanation of every adjustment. Truly
world-breaking intents (planet annihilation, absolute control) are
rejected with a constructive suggestion attached.
"""
from __future__ import annotations

import re
from typing import Any

from .schemas import CATEGORY_TRAIT_SPEC, StructuredContribution

# per-category power budgets: sum of designated power traits
POWER_BUDGET: dict[str, tuple[list[str], float]] = {
    "plant": (["size", "growthRate", "pollutionAbsorption", "energyStorage", "spreadRate"], 2.6),
    "creature": (["size", "reproductionRate", "aggression", "intelligence", "speed"], 2.7),
    "civilization": (["techLevel", "military", "innovation", "expansionism"], 2.2),
    "resource": (["value", "abundance", "renewable"], 2.0),
    "disease": (["severity", "transmission"], 1.3),
    "invention": (["complexity", "impact"], 1.6),
    "world_law": (["photosynthesisBoost", "cleanAir", "potency"], 1.2),
}

_HARD_REJECT = [
    (r"(يدمر|تدمير)\s+(الكوكب|العالم)\s*(فورًا|فوري|كليًا)?", "planet_destruction"),
    (r"\b(destroy|annihilate)\s+(the\s+)?(planet|world|earth)\b", "planet_destruction"),
    (r"سيطرة مطلقة|تحكم كامل على (الكوكب|العالم)", "absolute_control"),
    (r"\babsolute control|total domination|god mode\b", "absolute_control"),
    (r"طاقة (غير محدودة|لامتناهية)|\bunlimited energy\b", "unbounded_energy"),
    (r"(لا يموت|خالد).{0,40}(لا شيء|أبدي)|\bimmortal\b.{0,40}\binvincible\b", "immortality"),
]


def balance_check(contribution: StructuredContribution) -> dict[str, Any]:
    traits = contribution.normalized_traits()
    issues: list[dict[str, Any]] = []
    verdict = "ok"

    text = f"{contribution.name} {contribution.description or ''}"
    hard = None
    for pattern, code in _HARD_REJECT:
        if re.search(pattern, text, re.IGNORECASE):
            hard = code
            break

    budget = POWER_BUDGET.get(contribution.category)
    adjusted_traits = dict(traits)
    if budget:
        names, cap = budget
        total = sum(float(adjusted_traits.get(n, 0)) for n in names if isinstance(adjusted_traits.get(n), (int, float)))
        if total > cap:
            scale = cap / total
            for n in names:
                if isinstance(adjusted_traits.get(n), (int, float)):
                    before = adjusted_traits[n]
                    adjusted_traits[n] = round(float(before) * scale, 3)
                    issues.append({
                        "code": "power_budget",
                        "trait": n,
                        "from": before,
                        "to": adjusted_traits[n],
                    })
            verdict = "adjusted"

    # balance tax: powerful traits impose costs (keeps causality sane)
    if contribution.category == "plant":
        if float(adjusted_traits.get("energyStorage", 0)) > 0.6:
            if float(adjusted_traits.get("waterNeed", 0)) < 0.6:
                adjusted_traits["waterNeed"] = 0.6
                issues.append({"code": "balance_tax", "trait": "waterNeed", "to": 0.6,
                               "reason": "energy_storage_requires_water"})
        if float(adjusted_traits.get("growthRate", 0)) > 0.8 and float(adjusted_traits.get("nutrition", 0)) > 0.7:
            adjusted_traits["nutrition"] = 0.7
            issues.append({"code": "balance_tax", "trait": "nutrition", "to": 0.7,
                           "reason": "fast_growth_limits_nutrition"})
    if contribution.category == "creature":
        if float(adjusted_traits.get("size", 0)) > 0.8 and float(adjusted_traits.get("reproductionRate", 0)) > 0.6:
            adjusted_traits["reproductionRate"] = 0.6
            issues.append({"code": "balance_tax", "trait": "reproductionRate", "to": 0.6,
                           "reason": "large_body_slow_reproduction"})

    if issues:
        verdict = "adjusted"

    suggested = StructuredContribution(
        category=contribution.category,
        name=contribution.name,
        description=contribution.description,
        traits=adjusted_traits,
        possibleBiomes=contribution.possibleBiomes,
        risks=contribution.risks,
        provider="balance-rules",
        sandbox=True,
    )

    if hard:
        verdict = "rejected"
        issues.append({"code": hard, "severity": "fatal",
                       "message": "the_requested_effect_breaks_world_rules"})
        # still provide a playable version of the idea
        for n in (CATEGORY_TRAIT_SPEC[contribution.category]):
            lo, hi, default = CATEGORY_TRAIT_SPEC[contribution.category][n]
            suggested.traits[n] = min(float(adjusted_traits.get(n, default)), hi * 0.6)

    return {
        "verdict": verdict,
        "issues": issues,
        "suggested": suggested.model_dump() if (verdict != "ok") else None,
        "provider": "balance-rules",
        "sandbox": True,
    }
