from __future__ import annotations

import math

from .events import EventType, SimulationEvent, make_event
from .models import City, Civilization, Region
from .rng import SeededRNG, stable_id
from .world_generator import clamp

CIV_NAMES = [
    ("Aster Dominion", "سيادة أستر"),
    ("River Lanterns", "فوانيس النهر"),
    ("Copper Covenant", "عهد النحاس"),
    ("Wind Archive", "أرشيف الريح"),
    ("Jade Caravan", "قافلة اليشم"),
    ("Solar Kin", "أهل الشمس"),
    ("Cloud Loom", "نول السحاب"),
    ("Obsidian League", "رابطة السبج"),
    ("Pearl Delta", "دلتا اللؤلؤ"),
    ("Cedar Union", "اتحاد الأرز"),
    ("Dawn Reef", "شعاب الفجر"),
    ("Ember Steppe", "سهوب الجمر"),
]

CITY_NAMES = [
    ("Noura", "نورا"),
    ("Qamar", "قمر"),
    ("Marsa", "مرسى"),
    ("Rawda", "روضة"),
    ("Safa", "صفا"),
    ("Jisr", "جسر"),
    ("Manar", "منار"),
    ("Wahat", "واحة"),
    ("Hajar", "حجر"),
    ("Sahil", "ساحل"),
    ("Burj", "برج"),
    ("Zahra", "زهرة"),
]


def settlement_score(region: Region) -> float:
    if region.biome in {"ocean", "ice", "volcanic"}:
        return -1.0
    resource_score = (
        region.resources.get("food", 0.0) * 0.010
        + region.resources.get("freshwater", 0.0) * 0.012
        + region.resources.get("wood", 0.0) * 0.004
        + region.resources.get("ore", 0.0) * 0.004
        + region.resources.get("fish", 0.0) * 0.003
    )
    climate_score = region.fertility * 0.8 + (1.0 - abs(region.temperature - 0.55)) * 0.35
    coast_bonus = 0.16 if region.biome in {"coast", "wetland"} else 0.0
    return resource_score + climate_score + coast_bonus - region.pollution * 0.45


def seed_civilizations(
    planet_id: str, seed: str, regions: dict[str, Region]
) -> tuple[dict[str, Civilization], dict[str, City], list[SimulationEvent]]:
    rng = SeededRNG(seed, "civilizations")
    candidates = sorted(regions.values(), key=lambda r: (-settlement_score(r), r.id))
    chosen: list[Region] = []
    min_distance = max(4, int(math.sqrt(len(regions)) // 3))
    for region in candidates:
        if len(chosen) >= 12:
            break
        if all(grid_distance(region, other, regions) >= min_distance for other in chosen):
            chosen.append(region)
    if len(chosen) < 12:
        for region in candidates:
            if region not in chosen:
                chosen.append(region)
            if len(chosen) >= 12:
                break

    civilizations: dict[str, Civilization] = {}
    cities: dict[str, City] = {}
    events: list[SimulationEvent] = []
    event_index = 0
    for idx, region in enumerate(chosen[:12]):
        civ_en, civ_ar = CIV_NAMES[idx % len(CIV_NAMES)]
        city_en, city_ar = CITY_NAMES[idx % len(CITY_NAMES)]
        civ_id = stable_id("civ", seed, idx, region.id)
        city_id = stable_id("city", seed, idx, region.id)
        base_population = 2800 + settlement_score(region) * 1800 + rng.uniform(0, 600)
        city = City(
            id=city_id,
            name=f"{city_en}-{idx + 1}",
            civ_id=civ_id,
            region_id=region.id,
            population=round(base_population, 3),
            infrastructure=round(0.22 + rng.uniform(0.0, 0.24), 5),
            wealth=round(1200 + region.resources.get("food", 0.0) * 25 + rng.uniform(0, 500), 3),
            labels={"en": city_en, "ar": city_ar},
        )
        civ = Civilization(
            id=civ_id,
            name=civ_en,
            capital_region_id=region.id,
            city_ids=[city_id],
            population=city.population,
            technology=round(0.10 + rng.uniform(0.0, 0.18), 5),
            aggression=round(0.18 + rng.uniform(0.0, 0.55), 5),
            cooperation=round(0.20 + rng.uniform(0.0, 0.60), 5),
            economy=round(0.20 + settlement_score(region) * 0.18, 5),
            food=round(region.resources.get("food", 0.0) + region.resources.get("fish", 0.0), 3),
            resources={k: round(v * 0.05, 3) for k, v in region.resources.items()},
            stability=round(0.62 + rng.uniform(0.0, 0.25), 5),
            labels={"en": civ_en, "ar": civ_ar},
        )
        region.owner_civ_id = civ_id
        region.population += city.population
        civilizations[civ_id] = civ
        cities[city_id] = city
        events.append(
            make_event(
                planet_id,
                0,
                EventType.CIVILIZATION_FOUNDED,
                "initial_civilization_seed",
                region.id,
                0.98,
                {"population": city.population, "technology": civ.technology},
                {"settlement_score": settlement_score(region)},
                event_index,
                {"en": "Civilization founded", "ar": "تأسيس حضارة"},
                {"civ_id": civ_id},
            )
        )
        event_index += 1
        events.append(
            make_event(
                planet_id,
                0,
                EventType.CITY_CREATED,
                "initial_capital_seed",
                region.id,
                0.98,
                {"population": city.population, "infrastructure": city.infrastructure},
                {"civ_id": 1.0},
                event_index,
                {"en": "City created", "ar": "إنشاء مدينة"},
                {"city_id": city_id, "civ_id": civ_id},
            )
        )
        event_index += 1
    return civilizations, cities, events


def advance_civilizations(state, event_index: int) -> list[SimulationEvent]:
    events: list[SimulationEvent] = []
    for civ in sorted(state.civilizations.values(), key=lambda item: item.id):
        owned_regions = [r for r in state.regions.values() if r.owner_civ_id == civ.id]
        if not owned_regions:
            continue
        food_income = sum(r.resources.get("food", 0.0) + r.resources.get("fish", 0.0) for r in owned_regions) * 0.018
        pollution_penalty = sum(r.pollution for r in owned_regions) / len(owned_regions)
        drought_penalty = sum(r.drought for r in owned_regions) / len(owned_regions)
        civ.food = round(max(0.0, civ.food + food_income - civ.population * 0.00062 - drought_penalty * 12), 6)
        growth = civ.population * (0.006 + civ.food / max(1.0, civ.population) * 0.0005 - pollution_penalty * 0.003)
        civ.population = round(max(0.0, civ.population + growth), 6)
        civ.economy = round(clamp(civ.economy + food_income * 0.0004 + civ.technology * 0.002 - pollution_penalty * 0.006), 6)
        civ.stability = round(clamp(civ.stability + civ.food / max(1.0, civ.population) * 0.002 - drought_penalty * 0.012), 6)
        for city_id in civ.city_ids:
            city = state.cities[city_id]
            share = city.population / max(1.0, sum(state.cities[c].population for c in civ.city_ids))
            city.population = round(max(0.0, city.population + growth * share), 6)
            city.wealth = round(max(0.0, city.wealth + civ.economy * 4.0 - pollution_penalty * 8.0), 6)
            state.regions[city.region_id].population = city.population

        tech_utility = civ.economy * 0.38 + civ.cooperation * 0.16 + math.log1p(civ.population) * 0.018
        if tech_utility > 0.47 + civ.technology * 0.62 and state.tick % 9 == 0:
            delta = min(0.045, tech_utility * 0.035)
            civ.technology = round(clamp(civ.technology + delta), 6)
            events.append(
                make_event(
                    state.planet_id,
                    state.tick,
                    EventType.TECHNOLOGY_DISCOVERED,
                    f"utility_ai:{civ.id}:research",
                    civ.capital_region_id,
                    0.77,
                    {"technology": delta},
                    {"economy": civ.economy, "cooperation": civ.cooperation},
                    event_index + len(events),
                    {"en": "Technology discovered", "ar": "اكتشاف تقنية"},
                    {"civ_id": civ.id},
                )
            )

        city_utility = civ.population / max(1, len(civ.city_ids)) / 4500 + civ.food / max(1.0, civ.population) * 0.8
        if len(civ.city_ids) < 4 and city_utility > 0.95 and state.tick % 13 == 0:
            target = best_expansion_region(state, civ.id)
            if target:
                city_id = stable_id("city", state.seed, civ.id, state.tick, target.id)
                city = City(
                    id=city_id,
                    name=f"Outpost-{len(civ.city_ids) + 1}",
                    civ_id=civ.id,
                    region_id=target.id,
                    population=round(civ.population * 0.08, 6),
                    infrastructure=0.16,
                    wealth=round(civ.economy * 900, 6),
                    labels={"en": "Outpost", "ar": "مستوطنة"},
                )
                target.owner_civ_id = civ.id
                target.population += city.population
                state.cities[city_id] = city
                civ.city_ids.append(city_id)
                events.append(
                    make_event(
                        state.planet_id,
                        state.tick,
                        EventType.CITY_CREATED,
                        f"utility_ai:{civ.id}:expand",
                        target.id,
                        0.73,
                        {"population": city.population, "infrastructure": city.infrastructure},
                        {"settlement_score": settlement_score(target)},
                        event_index + len(events),
                        {"en": "City created", "ar": "إنشاء مدينة"},
                        {"city_id": city_id, "civ_id": civ.id},
                    )
                )

        if civ.stability < 0.36 and state.tick % 11 == 0:
            source = state.regions[civ.capital_region_id]
            target = best_migration_region(state, source)
            if target:
                movers = civ.population * 0.035
                source.population = round(max(0.0, source.population - movers), 6)
                target.population = round(target.population + movers, 6)
                events.append(
                    make_event(
                        state.planet_id,
                        state.tick,
                        EventType.MIGRATION_STARTED,
                        f"utility_ai:{civ.id}:low_stability",
                        source.id,
                        0.71,
                        {"population": -movers},
                        {"target_region_population": movers, "target_region": float(target.y * 1000 + target.x)},
                        event_index + len(events),
                        {"en": "Migration started", "ar": "بدء هجرة"},
                        {"civ_id": civ.id, "target_region_id": target.id},
                    )
                )

        disease_risk = pollution_penalty * 0.45 + max(0.0, civ.population / max(1, len(civ.city_ids)) - 9000) / 25000
        if disease_risk > 0.42 and state.tick % 17 == 0:
            loss = civ.population * min(0.06, disease_risk * 0.08)
            civ.population = round(civ.population - loss, 6)
            civ.stability = round(clamp(civ.stability - disease_risk * 0.08), 6)
            events.append(
                make_event(
                    state.planet_id,
                    state.tick,
                    EventType.DISEASE_OUTBREAK,
                    f"utility_ai:{civ.id}:health_risk",
                    civ.capital_region_id,
                    0.79,
                    {"population": -loss, "stability": -disease_risk * 0.08},
                    {"pollution": pollution_penalty},
                    event_index + len(events),
                    {"en": "Disease outbreak", "ar": "تفشي مرض"},
                    {"civ_id": civ.id},
                )
            )

    create_alliances(state, events, event_index)
    return events


def create_alliances(state, events: list[SimulationEvent], event_index: int) -> None:
    civs = sorted(state.civilizations.values(), key=lambda item: item.id)
    for i, civ_a in enumerate(civs):
        for civ_b in civs[i + 1 :]:
            if civ_b.id in civ_a.alliances or civ_b.id in civ_a.at_war:
                continue
            score = civ_a.cooperation * civ_b.cooperation + trade_affinity(state, civ_a.id, civ_b.id) * 0.2
            if score > 0.58 and (state.tick + i) % 23 == 0:
                civ_a.alliances.append(civ_b.id)
                civ_b.alliances.append(civ_a.id)
                events.append(
                    make_event(
                        state.planet_id,
                        state.tick,
                        EventType.ALLIANCE_CREATED,
                        "utility_ai:diplomacy",
                        civ_a.capital_region_id,
                        0.75,
                        {"cooperation": score},
                        {"trade_affinity": trade_affinity(state, civ_a.id, civ_b.id)},
                        event_index + len(events),
                        {"en": "Alliance created", "ar": "إنشاء تحالف"},
                        {"civ_a": civ_a.id, "civ_b": civ_b.id},
                    )
                )


def best_expansion_region(state, civ_id: str) -> Region | None:
    owned = [r for r in state.regions.values() if r.owner_civ_id == civ_id]
    candidates: dict[str, Region] = {}
    for region in owned:
        for nid in region.neighbors:
            nr = state.regions[nid]
            if nr.owner_civ_id is None and nr.biome not in {"ocean", "ice", "volcanic"}:
                candidates[nid] = nr
    if not candidates:
        return None
    return sorted(candidates.values(), key=lambda r: (-settlement_score(r), r.id))[0]


def best_migration_region(state, source: Region) -> Region | None:
    candidates = [state.regions[nid] for nid in source.neighbors if state.regions[nid].biome not in {"ocean", "ice"}]
    if not candidates:
        return None
    return sorted(candidates, key=lambda r: (r.pollution + r.drought - r.fertility, r.id))[0]


def grid_distance(a: Region, b: Region, regions: dict[str, Region]) -> int:
    cols = max(r.x for r in regions.values()) + 1
    dx = min(abs(a.x - b.x), cols - abs(a.x - b.x))
    return int(dx + abs(a.y - b.y))


def trade_affinity(state, civ_a: str, civ_b: str) -> float:
    route_volume = sum(
        route.volume
        for route in state.trade_routes
        if {state.cities[route.city_a].civ_id, state.cities[route.city_b].civ_id} == {civ_a, civ_b}
    )
    return min(1.0, route_volume / 400.0)

