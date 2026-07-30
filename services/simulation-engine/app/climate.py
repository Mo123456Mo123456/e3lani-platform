from __future__ import annotations

import math

from .events import EventType, SimulationEvent, make_event
from .world_generator import clamp


def advance_climate(state, event_index: int) -> list[SimulationEvent]:
    regions = state.regions
    pollution_next: dict[str, float] = {}
    drought_next: dict[str, float] = {}
    storm_next: dict[str, float] = {}
    events: list[SimulationEvent] = []

    for rid, region in sorted(regions.items()):
        neighbor_pollution = sum(regions[nid].pollution for nid in region.neighbors) / max(1, len(region.neighbors))
        neighbor_moisture = sum(regions[nid].moisture for nid in region.neighbors) / max(1, len(region.neighbors))
        seasonal = 0.5 + 0.5 * math.sin((state.tick + region.y * 0.8) / 7.0)
        dryness = clamp(1.0 - region.moisture + region.temperature * 0.24)
        storm_source = clamp(region.moisture * region.temperature * (0.42 + 0.58 * seasonal))
        pollution_next[rid] = clamp(region.pollution * 0.88 + neighbor_pollution * 0.10 + industrial_pressure(state, rid))
        drought_next[rid] = clamp(region.drought * 0.70 + dryness * 0.22 - neighbor_moisture * 0.04)
        storm_next[rid] = clamp(region.storm_energy * 0.62 + storm_source * 0.32)

    climate_changes: list[tuple[float, str, float, float]] = []
    pollution_changes: list[tuple[float, str, float]] = []
    for rid, region in sorted(regions.items()):
        old_drought = region.drought
        old_storm = region.storm_energy
        old_pollution = region.pollution
        region.drought = round(drought_next[rid], 6)
        region.storm_energy = round(storm_next[rid], 6)
        region.pollution = round(pollution_next[rid], 6)
        climate_delta = abs(region.drought - old_drought) + abs(region.storm_energy - old_storm)
        pollution_delta = abs(region.pollution - old_pollution)
        if climate_delta > 0.18:
            climate_changes.append((climate_delta, rid, region.drought - old_drought, region.storm_energy - old_storm))
        if pollution_delta > 0.035:
            pollution_changes.append((pollution_delta, rid, region.pollution - old_pollution))
        if region.biome == "volcanic" and volcanic_pressure(state.tick, rid, region.storm_energy) > 0.995:
            region.pollution = round(clamp(region.pollution + 0.12), 6)
            region.fertility = round(clamp(region.fertility - 0.04), 6)
            events.append(
                make_event(
                    state.planet_id,
                    state.tick,
                    EventType.VOLCANO_ERUPTED,
                    "volcanic_pressure",
                    rid,
                    0.87,
                    {"pollution": 0.12, "fertility": -0.04},
                    {"ash_cloud": region.storm_energy},
                    event_index + len(events),
                    {"en": "Volcano erupted", "ar": "ثوران بركان"},
                    {},
                )
            )

    for _, rid, drought_delta, storm_delta in sorted(climate_changes, reverse=True)[:4]:
        events.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.CLIMATE_CHANGED,
                "cellular_climate_automata",
                rid,
                min(0.95, 0.55 + abs(drought_delta) + abs(storm_delta)),
                {"drought": drought_delta, "storm_energy": storm_delta},
                {"neighbor_feedback": average_neighbor_feedback(state, rid)},
                event_index + len(events),
                {"en": "Climate changed", "ar": "تغير المناخ"},
                {},
            )
        )
    for _, rid, delta in sorted(pollution_changes, reverse=True)[:4]:
        events.append(
            make_event(
                state.planet_id,
                state.tick,
                EventType.POLLUTION_CHANGED,
                "pollution_diffusion",
                rid,
                min(0.94, 0.62 + abs(delta) * 4),
                {"pollution": delta},
                {"spread_from_neighbors": regions[rid].pollution},
                event_index + len(events),
                {"en": "Pollution changed", "ar": "تغير التلوث"},
                {},
            )
        )
    state.metrics["mean_pollution"] = round(sum(r.pollution for r in regions.values()) / len(regions), 6)
    state.metrics["mean_drought"] = round(sum(r.drought for r in regions.values()) / len(regions), 6)
    state.metrics["mean_storm_energy"] = round(sum(r.storm_energy for r in regions.values()) / len(regions), 6)
    return events


def industrial_pressure(state, region_id: str) -> float:
    region = state.regions[region_id]
    if not region.owner_civ_id or region.owner_civ_id not in state.civilizations:
        return 0.0
    civ = state.civilizations[region.owner_civ_id]
    city_pressure = sum(
        city.infrastructure * city.population / 1_000_000.0
        for city in state.cities.values()
        if city.region_id == region_id
    )
    return clamp((civ.technology * 0.004 + city_pressure * 0.012), 0.0, 0.018)


def volcanic_pressure(tick: int, region_id: str, storm: float) -> float:
    numeric = sum(ord(ch) for ch in region_id)
    return 0.5 + 0.5 * math.sin(tick / 13.0 + numeric * 0.017 + storm)


def average_neighbor_feedback(state, region_id: str) -> float:
    region = state.regions[region_id]
    if not region.neighbors:
        return 0.0
    return round(
        sum(state.regions[n].storm_energy + state.regions[n].drought for n in region.neighbors)
        / len(region.neighbors),
        6,
    )

