from __future__ import annotations

from app.models import BalanceResponse, StructuredElement
from app.validation import clamp, unique_preserve_order


NERF_RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    (
        "immortality",
        ("immortal", "never dies", "خالد", "لا يموت"),
        "Replaced immortality with long lifespan and simulator-controlled mortality.",
    ),
    (
        "infinite_energy",
        ("infinite energy", "unlimited energy", "طاقة لا نهائية", "طاقة غير محدودة"),
        "Replaced infinite energy with high but finite energy output.",
    ),
    (
        "unlimited_reproduction",
        ("unlimited reproduction", "reproduce without limit", "تكاثر غير محدود", "يتكاثر بلا حد"),
        "Replaced unlimited reproduction with capped fertility and resource-dependent growth.",
    ),
)

REJECT_RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    (
        "destroy_planet",
        ("destroy planet instantly", "destroy the planet instantly", "يدمر الكوكب فورا", "تدمير الكوكب فورا"),
        "Cannot accept instant planet destruction; suggest a localized disaster with bounded radius.",
    ),
    (
        "absolute_control",
        ("absolute control", "control everything", "سيطرة مطلقة", "يتحكم بكل شيء"),
        "Cannot accept absolute control; suggest influence over one bounded region or species.",
    ),
    (
        "cancel_laws",
        ("cancel all laws", "ignore all natural laws", "يلغي كل القوانين", "إلغاء كل القوانين"),
        "Cannot accept canceling all laws; suggest one localized natural-law anomaly.",
    ),
)


def balance_element(element: StructuredElement) -> BalanceResponse:
    balanced = element.model_copy(deep=True)
    notes: list[str] = list(balanced.balanceNotes or [])
    rejected = False
    blob = _element_blob(balanced)

    for rule_name, keywords, note in NERF_RULES:
        if any(keyword in blob for keyword in keywords):
            _apply_nerf(balanced, rule_name)
            notes.append(note)

    for rule_name, keywords, note in REJECT_RULES:
        if any(keyword in blob for keyword in keywords):
            rejected = True
            _apply_rejection_hint(balanced, rule_name)
            notes.append(note)

    excessive_notes = _cap_excessive_traits(balanced)
    notes.extend(excessive_notes)

    if notes != list(element.balanceNotes or []):
        balanced.wasBalanced = True
        balanced.balanceNotes = unique_preserve_order(notes)
        balanced.balanceScore = _score_balanced_element(balanced, rejected)

    return BalanceResponse(element=balanced, notes=balanced.balanceNotes or [], rejected=rejected)


def _element_blob(element: StructuredElement) -> str:
    parts = [
        element.name,
        element.nameAr or "",
        element.nameEn or "",
        element.description,
        " ".join(element.risks),
        " ".join(element.benefits),
    ]
    return " ".join(parts).lower()


def _apply_nerf(element: StructuredElement, rule_name: str) -> None:
    if rule_name == "immortality":
        element.traits.adaptability = min(element.traits.adaptability or 0.75, 0.75)
        element.traits.fertility = min(element.traits.fertility or 0.6, 0.6)
        element.description = _append_constraint(
            element.description,
            "Balanced constraint: long-lived but mortal under simulation rules.",
        )
    elif rule_name == "infinite_energy":
        element.traits.energyOutput = min(element.traits.energyOutput or 0.75, 0.75)
        element.description = _append_constraint(
            element.description,
            "Balanced constraint: finite energy output with depletion and recharge limits.",
        )
    elif rule_name == "unlimited_reproduction":
        element.traits.fertility = min(element.traits.fertility or 0.65, 0.65)
        element.traits.growthRate = min(element.traits.growthRate, 0.7)
        element.description = _append_constraint(
            element.description,
            "Balanced constraint: reproduction depends on habitat capacity and resources.",
        )


def _apply_rejection_hint(element: StructuredElement, rule_name: str) -> None:
    hints = {
        "destroy_planet": "Rejected unsafe scope: replace with a bounded regional disaster.",
        "absolute_control": "Rejected unsafe scope: replace with limited influence over a defined target.",
        "cancel_laws": "Rejected unsafe scope: replace with one temporary localized anomaly.",
    }
    element.description = _append_constraint(element.description, hints[rule_name])
    element.risks = unique_preserve_order([*element.risks, "Rejected god-mode scope."])


def _cap_excessive_traits(element: StructuredElement) -> list[str]:
    notes: list[str] = []
    for trait_name, value in element.traits.model_dump().items():
        if isinstance(value, (int, float)) and value > 0.9:
            setattr(element.traits, trait_name, 0.85)
            notes.append(f"Capped {trait_name} from {value:.2f} to 0.85.")
    return notes


def _append_constraint(description: str, constraint: str) -> str:
    if constraint in description:
        return description
    return f"{description} {constraint}"


def _score_balanced_element(element: StructuredElement, rejected: bool) -> float:
    if rejected:
        return 0.05
    trait_values = [
        value
        for value in element.traits.model_dump().values()
        if isinstance(value, (int, float))
    ]
    average = sum(trait_values) / len(trait_values) if trait_values else 0.5
    risk_penalty = min(0.35, len(element.risks) * 0.06)
    return clamp(0.85 - abs(average - 0.55) - risk_penalty)
