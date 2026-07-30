from __future__ import annotations

from .events import EventType, SimulationEvent, make_event
from .models import Civilization, PlanetState


def evaluate_conflicts(state: PlanetState, event_index: int) -> list[SimulationEvent]:
    events: list[SimulationEvent] = []
    civs = sorted(state.civilizations.values(), key=lambda civ: civ.id)
    borders = border_pairs(state)
    for i, civ_a in enumerate(civs):
        for civ_b in civs[i + 1 :]:
            score = war_score(state, civ_a, civ_b, borders.get(frozenset({civ_a.id, civ_b.id}), 0))
            at_war = civ_b.id in civ_a.at_war
            if not at_war and score > 0.72:
                civ_a.at_war.append(civ_b.id)
                civ_b.at_war.append(civ_a.id)
                if civ_b.id in civ_a.alliances:
                    civ_a.alliances.remove(civ_b.id)
                if civ_a.id in civ_b.alliances:
                    civ_b.alliances.remove(civ_a.id)
                civ_a.stability = round(max(0.0, civ_a.stability - 0.045), 6)
                civ_b.stability = round(max(0.0, civ_b.stability - 0.045), 6)
                events.append(
                    make_event(
                        state.planet_id,
                        state.tick,
                        EventType.WAR_STARTED,
                        "deterministic_war_score",
                        contested_region(state, civ_a.id, civ_b.id),
                        0.84,
                        {"war_score": score, "stability": -0.045},
                        {"border_tension": borders.get(frozenset({civ_a.id, civ_b.id}), 0)},
                        event_index + len(events),
                        {"en": "War started", "ar": "اندلاع حرب"},
                        {"civ_a": civ_a.id, "civ_b": civ_b.id},
                    )
                )
            elif at_war and score < 0.38:
                civ_a.at_war.remove(civ_b.id)
                civ_b.at_war.remove(civ_a.id)
                civ_a.stability = round(min(1.0, civ_a.stability + 0.035), 6)
                civ_b.stability = round(min(1.0, civ_b.stability + 0.035), 6)
                events.append(
                    make_event(
                        state.planet_id,
                        state.tick,
                        EventType.WAR_ENDED,
                        "deterministic_war_score",
                        contested_region(state, civ_a.id, civ_b.id),
                        0.80,
                        {"war_score": score, "stability": 0.035},
                        {"trade_dependency": trade_dependency(state, civ_a.id, civ_b.id)},
                        event_index + len(events),
                        {"en": "War ended", "ar": "انتهاء حرب"},
                        {"civ_a": civ_a.id, "civ_b": civ_b.id},
                    )
                )
    state.metrics["active_wars"] = float(sum(len(c.at_war) for c in state.civilizations.values()) // 2)
    return events


def border_pairs(state: PlanetState) -> dict[frozenset[str], int]:
    pairs: dict[frozenset[str], int] = {}
    for region in state.regions.values():
        if not region.owner_civ_id:
            continue
        for nid in region.neighbors:
            other = state.regions[nid]
            if other.owner_civ_id and other.owner_civ_id != region.owner_civ_id:
                key = frozenset({region.owner_civ_id, other.owner_civ_id})
                pairs[key] = pairs.get(key, 0) + 1
    return pairs


def war_score(state: PlanetState, civ_a: Civilization, civ_b: Civilization, border_count: int) -> float:
    scarcity_a = max(0.0, civ_a.population * 0.00072 - civ_a.food) / max(1.0, civ_a.population * 0.00072)
    scarcity_b = max(0.0, civ_b.population * 0.00072 - civ_b.food) / max(1.0, civ_b.population * 0.00072)
    aggression = (civ_a.aggression + civ_b.aggression) / 2
    instability = 1.0 - (civ_a.stability + civ_b.stability) / 2
    border_tension = min(1.0, border_count / 6.0)
    trade_peace = trade_dependency(state, civ_a.id, civ_b.id) * 0.28
    alliance_peace = 0.34 if civ_b.id in civ_a.alliances else 0.0
    tech_gap = abs(civ_a.technology - civ_b.technology) * 0.18
    score = (
        aggression * 0.34
        + max(scarcity_a, scarcity_b) * 0.25
        + border_tension * 0.22
        + instability * 0.14
        + tech_gap
        - trade_peace
        - alliance_peace
    )
    return round(max(0.0, min(1.0, score)), 6)


def trade_dependency(state: PlanetState, civ_a: str, civ_b: str) -> float:
    volume = 0.0
    for route in state.trade_routes:
        city_a = state.cities[route.city_a]
        city_b = state.cities[route.city_b]
        if {city_a.civ_id, city_b.civ_id} == {civ_a, civ_b}:
            volume += route.volume
    return min(1.0, volume / 600.0)


def contested_region(state: PlanetState, civ_a: str, civ_b: str) -> str | None:
    for region in sorted(state.regions.values(), key=lambda r: r.id):
        if region.owner_civ_id != civ_a:
            continue
        if any(state.regions[nid].owner_civ_id == civ_b for nid in region.neighbors):
            return region.id
    return state.civilizations[civ_a].capital_region_id

