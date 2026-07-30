"""Balance overpowered elements and propose safer alternatives."""

from __future__ import annotations

from .schemas import BalanceResult, StructuredElementOutput

POWER_TRAITS = (
    "power",
    "destruction",
    "predation",
    "toxicity",
    "aggression",
    "greenhouse",
    "omnipotence",
)

SOFT_CAPS = {
    "power": 0.75,
    "destruction": 0.6,
    "predation": 0.7,
    "toxicity": 0.65,
    "aggression": 0.7,
    "greenhouse": 0.55,
    "omnipotence": 0.0,
}


def _power_score(traits: dict[str, float]) -> float:
    if not traits:
        return 0.0
    weighted = 0.0
    weight_sum = 0.0
    for k, v in traits.items():
        w = 2.0 if k in POWER_TRAITS else 1.0
        weighted += w * float(v)
        weight_sum += w
    return weighted / weight_sum if weight_sum else 0.0


def balance_element(element: StructuredElementOutput) -> BalanceResult:
    """Cap extreme traits, strip omnipotence, propose milder alternatives."""
    adjustments: list[str] = []
    traits = dict(element.traits)
    was_overpowered = _power_score(traits) >= 0.72 or any(
        float(traits.get(k, 0)) > SOFT_CAPS.get(k, 1.0) for k in POWER_TRAITS if k in traits
    )

    for key, cap in SOFT_CAPS.items():
        if key in traits and float(traits[key]) > cap:
            adjustments.append(f"capped {key}: {traits[key]:.2f} → {cap:.2f}")
            traits[key] = cap

    # Ensure at least one counter-trait for high destruction
    if float(traits.get("destruction", 0)) >= 0.5 and float(traits.get("cleanup", 0)) < 0.2:
        traits["cleanup"] = 0.25
        adjustments.append("added cleanup=0.25 to offset destruction")

    risks = list(element.risks)
    if was_overpowered and "balance_nerf" not in risks:
        risks.append("balance_nerf")
        adjustments.append("flagged risk: balance_nerf")

    balanced = StructuredElementOutput(
        category=element.category,
        name=element.name,
        traits=traits,
        possibleBiomes=list(element.possibleBiomes),
        risks=risks,
        narrative=element.narrative
        + (" (balanced for simulation stability)" if was_overpowered else ""),
    )

    alternatives: list[StructuredElementOutput] = []
    if was_overpowered:
        mild_traits = {k: min(0.45, float(v) * 0.6) for k, v in traits.items()}
        mild_traits["fertility"] = max(mild_traits.get("fertility", 0.3), 0.3)
        alternatives.append(
            StructuredElementOutput(
                category=element.category,
                name=f"{element.name} (tempered)",
                traits=mild_traits,
                possibleBiomes=list(element.possibleBiomes) or ["plains", "forest"],
                risks=["localized_impact"],
                narrative=f"A milder variant of {element.name} with localized ecological impact.",
            )
        )
        alternatives.append(
            StructuredElementOutput(
                category="flora" if element.category == "fauna" else element.category,
                name=f"Echo of {element.name}",
                traits={"fertility": 0.4, "cleanup": 0.35, "toxicity": 0.1},
                possibleBiomes=["forest", "swamp"],
                risks=["slow_spread"],
                narrative=f"A restorative echo inspired by {element.name}, focused on cleanup.",
            )
        )

    return BalanceResult(
        balanced=balanced,
        was_overpowered=was_overpowered,
        adjustments=adjustments,
        alternatives=alternatives,
    )
