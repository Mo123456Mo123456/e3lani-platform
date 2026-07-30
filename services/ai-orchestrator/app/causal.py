"""Prior causal graph for a contribution.

Built from category mechanics + trait magnitudes. This is the expected
effect topology shown to the user BEFORE confirmation; realised events
come from the engine and are linked to the same contribution root.
"""
from __future__ import annotations

from typing import Any

from .schemas import CausalEdge, CausalGraph, CausalNode, StructuredContribution

_MECHANICS: dict[str, list[tuple[str, str, str, str, str]]] = {
    # (node_id, kind, label_ar, horizon, mechanism)
    "plant": [
        ("growth", "primary", "نمو وانتشار محلي", "short", "growth_rate_x_suitability"),
        ("water_draw", "primary", "استهلاك مياه التربة", "short", "water_need_draw"),
        ("air_cleaning", "secondary", "خفض التلوث المحلي", "medium", "absorption_x_density"),
        ("herbivore_adoption", "secondary", "اعتماد العواشب عليه", "medium", "nutrition_attraction"),
        ("industry", "longterm", "صناعات وطاقة محتملة", "long", "energy_storage_exploitation"),
        ("conflict", "longterm", "تنافس على مناطق النمو", "long", "scarcity_competition"),
    ],
    "creature": [
        ("population", "primary", "نمو السكان", "short", "reproduction_dynamics"),
        ("predation", "secondary", "ضغط افتراس على الفرائس", "medium", "food_web_pressure"),
        ("migration", "secondary", "هجرة نحو موائل أفضل", "medium", "habitat_search"),
        ("mutation", "longterm", "طفرات وأنواع فرعية", "long", "mutation_rate"),
        ("domestication", "longterm", "احتمال تدجين من الحضارات", "long", "intelligence_sociality"),
    ],
    "resource": [
        ("extraction", "primary", "استخراج من الحضارات المجاورة", "short", "value_attraction"),
        ("trade", "secondary", "طرق تجارة جديدة", "medium", "surplus_trade"),
        ("industry", "secondary", "تحفيز الاقتصاد", "medium", "production_boost"),
        ("conflict", "longterm", "نزاعات على السيطرة", "long", "scarcity_competition"),
        ("depletion", "longterm", "استنزاف وتلوث", "long", "extraction_impact"),
    ],
    "civilization": [
        ("expansion", "primary", "توسع إقليمي", "short", "expansionism_drive"),
        ("diplomacy", "secondary", "علاقات وتحالفات", "medium", "trust_building"),
        ("technology", "secondary", "تقدم تقني", "medium", "innovation_research"),
        ("conflict", "longterm", "احتكاكات حدودية", "long", "border_friction"),
    ],
    "invention": [
        ("adoption", "primary", "تبنّي من الحضارة الأكثر ابتكارًا", "short", "innovation_affinity"),
        ("industry", "secondary", "تحول إنتاجي", "medium", "tech_multiplier"),
        ("military", "secondary", "تغير موازين القوة", "medium", "tech_military_edge"),
        ("society", "longterm", "تحولات اجتماعية", "long", "education_shift"),
    ],
    "natural_phenomenon": [
        ("weather", "primary", "تغير نمط الطقس إقليميًا", "short", "moisture_temp_shift"),
        ("harvest", "secondary", "تأثير على الغطاء النباتي", "medium", "growth_conditions"),
        ("settlement", "longterm", "إعادة توزيع السكان", "long", "habitability_shift"),
    ],
    "disease": [
        ("outbreak", "primary", "تفشٍّ في المنطقة المصابة", "short", "transmission_spread"),
        ("trade_spread", "secondary", "انتقال عبر طرق التجارة", "medium", "route_vector"),
        ("mortality", "secondary", "وفيات وتراجع سكاني", "medium", "severity_vs_health"),
        ("medicine", "longterm", "تحفيز الطب والحجر", "long", "research_pressure"),
    ],
    "culture": [
        ("influence", "primary", "انتشار تأثير ثقافي", "short", "influence_broadcast"),
        ("happiness", "secondary", "رفع المعنويات", "medium", "cultural_morale"),
        ("education", "longterm", "تحفيز التعليم", "long", "cultural_education"),
    ],
    "world_law": [
        ("global_adjust", "primary", "إعادة ضبط عالمية", "short", "law_application"),
        ("biosphere", "secondary", "استجابة الغلاف الحيوي", "medium", "vegetation_response"),
        ("civilization_shift", "longterm", "إعادة تشكيل الحضارات", "long", "cascade_effects"),
    ],
    "custom": [
        ("imprint", "primary", "أثر محلي مستدام", "short", "local_modifier"),
        ("cascade", "longterm", "تداعيات غير مباشرة", "long", "system_response"),
    ],
}


def build_causal_graph(contribution: StructuredContribution) -> CausalGraph:
    traits = contribution.normalized_traits()
    potency = 0.3 + 0.7 * max(
        (float(v) for v in traits.values() if isinstance(v, (int, float))), default=0.5,
    )
    nodes = [CausalNode(id="root", kind="contribution", label=contribution.name,
                        horizon="now", strength=round(potency, 3))]
    edges: list[CausalEdge] = []
    for node_id, kind, label, horizon, mechanism in _MECHANICS[contribution.category]:
        strength = round(potency * {"primary": 1.0, "secondary": 0.7, "longterm": 0.5}[kind], 3)
        nodes.append(CausalNode(id=node_id, kind=kind, label=label, horizon=horizon,
                                strength=strength, mechanism=mechanism))
        negative = node_id in {"water_draw", "conflict", "depletion", "predation", "mortality", "trade_spread"}
        if kind == "primary":
            edges.append(CausalEdge(source="root", target=node_id,
                                    sign="-" if negative else "+", mechanism=mechanism))
        else:
            # chain: primary nodes feed secondary, secondary feed longterm
            primaries = [n.id for n in nodes if n.kind == "primary"]
            secondaries = [n.id for n in nodes if n.kind == "secondary"]
            src = secondaries[0] if kind == "longterm" and secondaries else primaries[0]
            edges.append(CausalEdge(source=src, target=node_id,
                                    sign="-" if negative else "+", mechanism=mechanism))
    return CausalGraph(nodes=nodes, edges=edges)
