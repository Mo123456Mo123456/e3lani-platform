from __future__ import annotations

import math

import networkx as nx

from .events import EventType, SimulationEvent, make_event
from .models import City, PlanetState, Region, TradeRoute
from .rng import stable_id

TRADE_RESOURCES = ("food", "wood", "ore", "minerals", "fish", "freshwater")


def build_region_graph(regions: dict[str, Region]) -> nx.Graph:
    graph = nx.Graph()
    for region in regions.values():
        graph.add_node(region.id)
        for nid in region.neighbors:
            neighbor = regions[nid]
            terrain_cost = 1.0 + max(0.0, neighbor.height - 0.55) * 1.8
            if neighbor.biome in {"mountain", "volcanic"}:
                terrain_cost += 1.2
            if neighbor.biome in {"ocean", "ice"}:
                terrain_cost += 2.6
            if neighbor.biome in {"coast", "plains", "wetland"}:
                terrain_cost -= 0.15
            graph.add_edge(region.id, nid, weight=max(0.25, terrain_cost))
    return graph


def initialize_trade(state: PlanetState) -> list[SimulationEvent]:
    state.trade_routes = []
    return update_economy(state, 0)


def update_economy(state: PlanetState, event_index: int) -> list[SimulationEvent]:
    graph = build_region_graph(state.regions)
    existing = {route.id for route in state.trade_routes}
    new_routes: list[TradeRoute] = []
    events: list[SimulationEvent] = []
    cities = sorted(state.cities.values(), key=lambda city: city.id)
    for i, city_a in enumerate(cities):
        for city_b in cities[i + 1 :]:
            if city_a.civ_id == city_b.civ_id:
                continue
            resource, imbalance = best_trade_resource(state, city_a, city_b)
            if imbalance < 2:
                continue
            try:
                path = nx.dijkstra_path(graph, city_a.region_id, city_b.region_id, weight="weight")
                distance = float(nx.path_weight(graph, path, weight="weight"))
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue
            if distance <= 0:
                continue
            diplomacy = diplomacy_multiplier(state, city_a.civ_id, city_b.civ_id)
            volume = max(0.0, imbalance * diplomacy / (1.0 + distance * 0.08))
            if volume < 1:
                continue
            route_id = stable_id("route", city_a.id, city_b.id, resource)
            new_routes.append(
                TradeRoute(
                    id=route_id,
                    city_a=city_a.id,
                    city_b=city_b.id,
                    path=path,
                    distance=round(distance, 6),
                    volume=round(volume, 6),
                    resource=resource,
                )
            )
            apply_trade_benefits(state, city_a, city_b, resource, volume)
            if route_id not in existing:
                events.append(
                    make_event(
                        state.planet_id,
                        state.tick,
                        EventType.TRADE_ROUTE_CREATED,
                        "dijkstra_supply_demand",
                        city_a.region_id,
                        0.82,
                        {"trade_volume": volume, "distance": distance},
                        {"resource_imbalance": imbalance},
                        event_index + len(events),
                        {"en": "Trade route created", "ar": "إنشاء طريق تجارة"},
                        {"route_id": route_id, "city_a": city_a.id, "city_b": city_b.id, "resource": resource},
                    )
                )
    state.trade_routes = sorted(new_routes, key=lambda route: (-route.volume, route.id))[:36]
    state.metrics["trade_volume"] = round(sum(route.volume for route in state.trade_routes), 6)
    return events


def best_trade_resource(state: PlanetState, city_a: City, city_b: City) -> tuple[str, float]:
    civ_a = state.civilizations[city_a.civ_id]
    civ_b = state.civilizations[city_b.civ_id]
    best = ("food", 0.0)
    for resource in TRADE_RESOURCES:
        supply_a = civ_a.resources.get(resource, 0.0) + state.regions[city_a.region_id].resources.get(resource, 0.0) * 0.04
        supply_b = civ_b.resources.get(resource, 0.0) + state.regions[city_b.region_id].resources.get(resource, 0.0) * 0.04
        demand_a = demand_for(resource, city_a, civ_a.technology)
        demand_b = demand_for(resource, city_b, civ_b.technology)
        surplus_a = supply_a - demand_a
        surplus_b = supply_b - demand_b
        imbalance = abs(surplus_a - surplus_b)
        if imbalance > best[1]:
            best = (resource, imbalance)
    return best


def demand_for(resource: str, city: City, technology: float) -> float:
    base = math.sqrt(max(1.0, city.population)) * 0.12
    if resource == "food":
        return base * 1.6
    if resource == "freshwater":
        return base * 1.1
    if resource == "ore":
        return base * (0.45 + technology)
    if resource == "wood":
        return base * 0.8
    if resource == "minerals":
        return base * (0.35 + technology * 0.7)
    if resource == "fish":
        return base * 0.5
    return base


def diplomacy_multiplier(state: PlanetState, civ_a_id: str, civ_b_id: str) -> float:
    civ_a = state.civilizations[civ_a_id]
    civ_b = state.civilizations[civ_b_id]
    if civ_b_id in civ_a.at_war:
        return 0.15
    if civ_b_id in civ_a.alliances:
        return 1.35
    return 0.68 + (civ_a.cooperation + civ_b.cooperation) * 0.32


def apply_trade_benefits(state: PlanetState, city_a: City, city_b: City, resource: str, volume: float) -> None:
    civ_a = state.civilizations[city_a.civ_id]
    civ_b = state.civilizations[city_b.civ_id]
    civ_a.economy = round(min(1.0, civ_a.economy + volume * 0.00006), 6)
    civ_b.economy = round(min(1.0, civ_b.economy + volume * 0.00006), 6)
    city_a.wealth = round(city_a.wealth + volume * 0.18, 6)
    city_b.wealth = round(city_b.wealth + volume * 0.18, 6)
    civ_a.resources[resource] = round(max(0.0, civ_a.resources.get(resource, 0.0) - volume * 0.015), 6)
    civ_b.resources[resource] = round(max(0.0, civ_b.resources.get(resource, 0.0) - volume * 0.015), 6)

