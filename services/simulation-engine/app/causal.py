from __future__ import annotations

import hashlib
import json
from collections import deque
from typing import Any

import networkx as nx

from .events import EventType, SimulationEvent, make_event
from .models import CausalEdge, City, ContributionRecord, PlanetState, StructuredElement
from .rng import stable_id
from .world_generator import clamp, fertility_for


def contribution_id(seed: str, user_id: str, region_id: str, tick: int, element: StructuredElement) -> str:
    element_json = json.dumps(element.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    raw = f"{seed}|{user_id}|{region_id}|{tick}|{element_json}"
    return "contrib_" + hashlib.sha256(raw.encode()).hexdigest()[:18]


def effect_profile(element: StructuredElement) -> dict[str, float]:
    etype = element.normalized_type()
    category = (element.category or "").lower()
    props = element.merged_properties()
    scale = float(props.get("scale", props.get("size", 1.0)))
    scale = max(0.1, min(10.0, scale))
    effects: dict[str, float] = {}

    def add(key: str, value: float) -> None:
        effects[key] = effects.get(key, 0.0) + value * scale

    if (
        any(token in etype for token in ("forest", "tree", "plant", "garden"))
        or category in {"ecology", "plant"}
    ):
        add("fertility", 0.055)
        add("moisture", 0.025)
        add("pollution", -0.035)
        add("food", 7.0)
        add("wood", 5.0)
        water_need = float(props.get("waterNeed", props.get("water_need", 0.5)))
        add("moisture", -0.01 * water_need)
    elif any(token in etype for token in ("factory", "mine", "industrial")) or category == "industry":
        add("pollution", 0.085)
        add("ore", 10.0)
        add("economy", 0.025)
        add("fertility", -0.025)
    elif any(token in etype for token in ("water", "river", "well", "cleanup")):
        add("moisture", 0.065)
        add("freshwater", 14.0)
        add("pollution", -0.045 if "cleanup" in etype else -0.012)
        add("fertility", 0.025)
    elif any(token in etype for token in ("city", "settlement", "house")) or category in {
        "city",
        "civilization",
    }:
        add("population", 650.0)
        add("economy", 0.018)
        add("pollution", 0.028)
        add("fertility", -0.012)
    elif any(token in etype for token in ("school", "lab", "technology", "library", "invention")) or category in {
        "technology",
        "invention",
    }:
        add("technology", 0.045)
        add("economy", 0.012)
    elif any(token in etype for token in ("sanctuary", "reserve", "animal", "creature")) or category == "creature":
        add("fertility", 0.035)
        add("pollution", -0.022)
        add("biodiversity", 0.05)
    elif category == "disease":
        add("population", -120.0)
        add("pollution", 0.01)
    elif category in {"disaster", "climate_phenomenon"}:
        add("pollution", 0.02)
        add("temperature", 0.01)
        add("fertility", -0.02)
    else:
        add("fertility", float(props.get("fertility_delta", 0.008)))
        add("economy", float(props.get("economy_delta", 0.004)))

    for key in (
        "fertility",
        "moisture",
        "temperature",
        "pollution",
        "population",
        "technology",
        "economy",
        "food",
        "wood",
        "ore",
        "freshwater",
        "biodiversity",
    ):
        if key in props:
            add(key, float(props[key]))
    return {k: round(v, 6) for k, v in effects.items() if abs(v) > 1e-9}


def build_region_causal_graph(state: PlanetState) -> nx.DiGraph:
    graph = nx.DiGraph()
    for region in state.regions.values():
        graph.add_node(region.id, kind="region")
        for nid in region.neighbors:
            graph.add_edge(region.id, nid, weight=0.42, relation="adjacent_diffusion")
        if region.owner_civ_id:
            graph.add_edge(region.id, region.owner_civ_id, weight=0.65, relation="supports_civilization")
    for civ in state.civilizations.values():
        graph.add_node(civ.id, kind="civilization")
        for city_id in civ.city_ids:
            graph.add_edge(civ.id, city_id, weight=0.72, relation="governs_city")
            graph.add_edge(city_id, civ.capital_region_id, weight=0.52, relation="urban_pressure")
    for edge in state.causal_edges:
        graph.add_edge(edge.source, edge.target, weight=edge.weight, relation=edge.relation)
    return graph


def apply_contribution(
    state: PlanetState,
    element: StructuredElement,
    region_id: str,
    user_id: str,
    event_index: int,
) -> tuple[ContributionRecord, list[SimulationEvent]]:
    if region_id not in state.regions:
        raise KeyError(f"unknown region_id: {region_id}")
    cid = contribution_id(state.seed, user_id, region_id, state.tick, element)
    effects = effect_profile(element)
    affected = propagate_region_effects(state, region_id, effects)
    events: list[SimulationEvent] = []
    for rid, region_effects in affected.items():
        apply_region_effects(state, rid, region_effects)
    apply_civilization_effects(state, region_id, effects)
    add_causal_edges(state, cid, affected, effects)

    direct = affected[region_id]
    indirect = aggregate_indirect(affected, region_id)
    events.append(
        make_event(
            state.planet_id,
            state.tick,
            EventType.CONTRIBUTION_APPLIED,
            f"user:{user_id}",
            region_id,
            0.93,
            direct,
            indirect,
            event_index + len(events),
            {"en": f"Contribution applied: {element.name}", "ar": f"تطبيق مساهمة: {element.name}"},
            {"contribution_id": cid, "element_type": element.normalized_type()},
        )
    )

    if direct.get("pollution", 0.0) != 0:
        events.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.POLLUTION_CHANGED,
                f"contribution:{cid}",
                region_id,
                0.86,
                {"pollution": direct["pollution"]},
                {"propagated_pollution": indirect.get("pollution", 0.0)},
                event_index + len(events),
                {"en": "Pollution changed", "ar": "تغير التلوث"},
                {"contribution_id": cid},
            )
        )
    etype = element.normalized_type()
    if direct.get("fertility", 0.0) > 0 and ("plant" in etype or "forest" in etype):
        events.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.PLANT_SPREAD,
                f"contribution:{cid}",
                region_id,
                0.78,
                {"fertility": direct.get("fertility", 0.0), "moisture": direct.get("moisture", 0.0)},
                indirect,
                event_index + len(events),
                {"en": "Plant spread", "ar": "انتشار نبات"},
                {"contribution_id": cid},
            )
        )
    if any(key in direct for key in ("ore", "freshwater", "food", "wood")):
        events.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.RESOURCE_DISCOVERED,
                f"contribution:{cid}",
                region_id,
                0.81,
                {k: v for k, v in direct.items() if k in {"ore", "freshwater", "food", "wood"}},
                {},
                event_index + len(events),
                {"en": "Resource changed", "ar": "تغير مورد"},
                {"contribution_id": cid},
            )
        )
    if "technology" in direct or "technology" in effects:
        events.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.TECHNOLOGY_DISCOVERED,
                f"contribution:{cid}",
                region_id,
                0.76,
                {"technology": effects.get("technology", 0.0)},
                {"economy": effects.get("economy", 0.0)},
                event_index + len(events),
                {"en": "Technology discovered", "ar": "اكتشاف تقنية"},
                {"contribution_id": cid},
            )
        )
    if "city" in etype or "settlement" in etype or element.category == "civilization":
        city = create_contribution_city(state, cid, region_id, effects)
        events.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.CITY_CREATED,
                f"contribution:{cid}",
                region_id,
                0.74,
                {"population": city.population, "infrastructure": city.infrastructure},
                {"economy": effects.get("economy", 0.0)},
                event_index + len(events),
                {"en": "City created", "ar": "إنشاء مدينة"},
                {"contribution_id": cid, "city_id": city.id},
            )
        )

    record = ContributionRecord(
        id=cid,
        user_id=user_id,
        region_id=region_id,
        tick=state.tick,
        element=element,
        effects=effects,
        affected_regions=affected,
        event_ids=[event.id for event in events],
    )
    state.contributions[cid] = record
    return record, events


def propagate_region_effects(
    state: PlanetState, origin: str, effects: dict[str, float], max_depth: int = 3
) -> dict[str, dict[str, float]]:
    affected: dict[str, dict[str, float]] = {}
    queue: deque[tuple[str, int, float]] = deque([(origin, 0, 1.0)])
    seen = {origin: 1.0}
    while queue:
        rid, depth, strength = queue.popleft()
        affected[rid] = {k: round(v * strength, 6) for k, v in effects.items()}
        if depth >= max_depth:
            continue
        region = state.regions[rid]
        for nid in region.neighbors:
            neighbor = state.regions[nid]
            terrain_loss = 0.55 + abs(neighbor.height - region.height) * 0.35
            if neighbor.biome in {"mountain", "ocean", "ice"}:
                terrain_loss += 0.18
            next_strength = strength * max(0.08, 1.0 - terrain_loss)
            if next_strength > 0.06 and next_strength > seen.get(nid, 0.0):
                seen[nid] = next_strength
                queue.append((nid, depth + 1, next_strength))
    return affected


def apply_region_effects(state: PlanetState, region_id: str, effects: dict[str, float]) -> None:
    region = state.regions[region_id]
    if "fertility" in effects:
        region.fertility = round(clamp(region.fertility + effects["fertility"]), 6)
    if "moisture" in effects:
        region.moisture = round(clamp(region.moisture + effects["moisture"]), 6)
    if "temperature" in effects:
        region.temperature = round(clamp(region.temperature + effects["temperature"]), 6)
    if "pollution" in effects:
        region.pollution = round(clamp(region.pollution + effects["pollution"]), 6)
    if "population" in effects:
        region.population = round(max(0.0, region.population + effects["population"]), 6)
    for resource in ("food", "wood", "ore", "freshwater", "minerals", "fish"):
        if resource in effects:
            region.resources[resource] = round(max(0.0, region.resources.get(resource, 0.0) + effects[resource]), 6)
    region.biome = adjusted_biome(region.biome, region.fertility, region.moisture, region.temperature, region.height)


def adjusted_biome(current: str, fertility: float, moisture: float, temp: float, height: float) -> str:
    if current in {"ocean", "ice", "mountain", "volcanic"}:
        return current
    if moisture > 0.78 and fertility > 0.62:
        return "wetland"
    if fertility > 0.72 and temp > 0.62 and moisture > 0.62:
        return "rainforest"
    if fertility > 0.58 and moisture > 0.48:
        return "temperate_forest"
    return current if current else "plains"


def apply_civilization_effects(state: PlanetState, region_id: str, effects: dict[str, float]) -> None:
    region = state.regions[region_id]
    if not region.owner_civ_id or region.owner_civ_id not in state.civilizations:
        return
    civ = state.civilizations[region.owner_civ_id]
    if "technology" in effects:
        civ.technology = round(clamp(civ.technology + effects["technology"]), 6)
    if "economy" in effects:
        civ.economy = round(clamp(civ.economy + effects["economy"]), 6)
    if "food" in effects:
        civ.food = round(max(0.0, civ.food + effects["food"] * 0.2), 6)
    for resource in ("food", "wood", "ore", "freshwater", "minerals", "fish"):
        if resource in effects:
            civ.resources[resource] = round(max(0.0, civ.resources.get(resource, 0.0) + effects[resource] * 0.1), 6)


def create_contribution_city(state: PlanetState, contribution_id_value: str, region_id: str, effects: dict[str, float]) -> City:
    region = state.regions[region_id]
    civ_id = region.owner_civ_id or next(iter(sorted(state.civilizations)))
    city_id = stable_id("city", contribution_id_value, region_id)
    if city_id in state.cities:
        return state.cities[city_id]
    population = max(120.0, effects.get("population", 650.0))
    city = City(
        id=city_id,
        name="User Settlement",
        civ_id=civ_id,
        region_id=region_id,
        population=round(population, 6),
        infrastructure=0.12,
        wealth=round(max(50.0, effects.get("economy", 0.02) * 5000), 6),
        labels={"en": "User Settlement", "ar": "مستوطنة مستخدم"},
    )
    state.cities[city_id] = city
    state.civilizations[civ_id].city_ids.append(city_id)
    region.owner_civ_id = civ_id
    return city


def add_causal_edges(
    state: PlanetState, contribution_id_value: str, affected: dict[str, dict[str, float]], effects: dict[str, float]
) -> None:
    for rid, region_effects in sorted(affected.items()):
        magnitude = sum(abs(v) for v in region_effects.values())
        state.causal_edges.append(
            CausalEdge(
                source=contribution_id_value,
                target=rid,
                weight=round(min(1.0, magnitude / max(0.01, sum(abs(v) for v in effects.values()))), 6),
                relation="contribution_effect",
            )
        )
        region = state.regions[rid]
        if region.owner_civ_id:
            state.causal_edges.append(
                CausalEdge(
                    source=rid,
                    target=region.owner_civ_id,
                    weight=0.58,
                    relation="regional_society_feedback",
                )
            )


def aggregate_indirect(affected: dict[str, dict[str, float]], origin: str) -> dict[str, float]:
    totals: dict[str, float] = {}
    for rid, effects in affected.items():
        if rid == origin:
            continue
        for key, value in effects.items():
            totals[key] = totals.get(key, 0.0) + value
    return {k: round(v, 6) for k, v in totals.items() if abs(v) > 1e-9}


def causal_paths_from_contribution(state: PlanetState, contribution_id_value: str) -> list[dict[str, Any]]:
    graph = build_region_causal_graph(state)
    if contribution_id_value not in graph:
        return []
    paths: list[dict[str, Any]] = []
    for target in graph.nodes:
        if target == contribution_id_value:
            continue
        try:
            path = nx.shortest_path(graph, contribution_id_value, target)
        except nx.NetworkXNoPath:
            continue
        if 1 < len(path) <= 4:
            weight = 1.0
            for src, dst in zip(path, path[1:]):
                weight *= float(graph[src][dst].get("weight", 0.0))
            paths.append({"target": target, "path": path, "confidence": round(min(1.0, weight), 6)})
    return sorted(paths, key=lambda item: (-item["confidence"], item["target"]))[:25]

