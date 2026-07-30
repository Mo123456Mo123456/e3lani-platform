from __future__ import annotations

from collections import defaultdict

from .events import EventType, SimulationEvent, make_event
from .models import Region, Species
from .rng import SeededRNG, stable_id
from .world_generator import clamp

PLANT_NAMES = [
    ("Sun Reed", "قصب الشمس"),
    ("Azure Moss", "طحلب أزرق"),
    ("Glass Fern", "سرخس زجاجي"),
    ("Copper Grass", "عشب نحاسي"),
    ("Rainroot", "جذر المطر"),
    ("Salt Bloom", "زهرة الملح"),
    ("Ember Lichen", "أشنة الجمر"),
    ("Moonleaf", "ورق القمر"),
]

HERBIVORE_NAMES = [
    ("Plain Strider", "عداء السهول"),
    ("River Grazer", "راعي النهر"),
    ("Canopy Glider", "منزلق المظلة"),
    ("Tundra Horn", "قرن التندرا"),
    ("Dune Hopper", "قافز الكثبان"),
]

CARNIVORE_NAMES = [
    ("Red Lynx", "وشق أحمر"),
    ("Storm Jackal", "ابن آوى العاصفة"),
    ("Glass Hawk", "صقر زجاجي"),
    ("Night Serpent", "أفعى الليل"),
]


def _habitable_regions(regions: dict[str, Region]) -> list[Region]:
    return [
        r
        for r in regions.values()
        if r.biome not in {"ocean", "ice"} and r.fertility > 0.18 and r.temperature > 0.12
    ]


def seed_ecosystem(
    planet_id: str, seed: str, regions: dict[str, Region]
) -> tuple[dict[str, Species], list[SimulationEvent]]:
    rng = SeededRNG(seed, "ecosystem")
    habitable = _habitable_regions(regions)
    by_biome: dict[str, list[Region]] = defaultdict(list)
    for region in habitable:
        by_biome[region.biome].append(region)

    species: dict[str, Species] = {}
    events: list[SimulationEvent] = []
    event_index = 0

    plant_biomes = [b for b, rs in by_biome.items() if rs]
    for idx in range(18):
        biome = rng.choice(plant_biomes)
        candidates = sorted(by_biome[biome], key=lambda r: (-r.fertility, r.id))
        start = rng.integers(0, max(1, len(candidates) // 2))
        region_ids = [r.id for r in candidates[start : start + 12]]
        en, ar = PLANT_NAMES[idx % len(PLANT_NAMES)]
        sid = stable_id("sp", seed, "plant", idx)
        capacity = sum(regions[rid].fertility for rid in region_ids) * 950.0
        species[sid] = Species(
            id=sid,
            name=f"{en} {idx + 1}",
            kind="plant",
            population=round(capacity * (0.42 + rng.uniform(0.0, 0.25)), 3),
            biomass=round(capacity * (0.55 + rng.uniform(0.0, 0.25)), 3),
            growth_rate=round(0.10 + rng.uniform(0.0, 0.08), 5),
            mortality_rate=round(0.018 + rng.uniform(0.0, 0.025), 5),
            carrying_capacity=round(capacity, 3),
            region_ids=region_ids,
            labels={"en": en, "ar": ar},
        )
        events.append(
            make_event(
                planet_id,
                0,
                EventType.SPECIES_CREATED,
                "initial_ecosystem_seed",
                region_ids[0] if region_ids else None,
                0.96,
                {"population": species[sid].population},
                {"biome_fertility": round(capacity / 950.0, 6)},
                event_index,
                {"en": "Species created", "ar": "نشوء نوع"},
                {"species_id": sid, "kind": "plant"},
            )
        )
        event_index += 1

    plant_ids = [sid for sid, sp in species.items() if sp.kind == "plant"]
    for idx in range(10):
        prey = rng.choice(plant_ids)
        prey_regions = species[prey].region_ids
        en, ar = HERBIVORE_NAMES[idx % len(HERBIVORE_NAMES)]
        sid = stable_id("sp", seed, "herbivore", idx)
        capacity = species[prey].biomass * 0.11
        species[sid] = Species(
            id=sid,
            name=f"{en} {idx + 1}",
            kind="herbivore",
            population=round(capacity * (0.22 + rng.uniform(0.0, 0.18)), 3),
            biomass=round(capacity * 0.75, 3),
            growth_rate=round(0.055 + rng.uniform(0.0, 0.045), 5),
            mortality_rate=round(0.028 + rng.uniform(0.0, 0.035), 5),
            carrying_capacity=round(capacity, 3),
            region_ids=prey_regions[:10],
            prey_ids=[prey],
            labels={"en": en, "ar": ar},
        )
        events.append(
            make_event(
                planet_id,
                0,
                EventType.SPECIES_CREATED,
                "initial_food_web_seed",
                prey_regions[0] if prey_regions else None,
                0.94,
                {"population": species[sid].population},
                {"prey_biomass": species[prey].biomass},
                event_index,
                {"en": "Herbivore emerged", "ar": "ظهور عاشب"},
                {"species_id": sid, "prey_ids": [prey]},
            )
        )
        event_index += 1

    herbivore_ids = [sid for sid, sp in species.items() if sp.kind == "herbivore"]
    for idx in range(6):
        prey = rng.choice(herbivore_ids)
        prey_regions = species[prey].region_ids
        en, ar = CARNIVORE_NAMES[idx % len(CARNIVORE_NAMES)]
        sid = stable_id("sp", seed, "carnivore", idx)
        capacity = species[prey].biomass * 0.09
        species[sid] = Species(
            id=sid,
            name=f"{en} {idx + 1}",
            kind="carnivore",
            population=round(capacity * (0.18 + rng.uniform(0.0, 0.16)), 3),
            biomass=round(capacity * 0.55, 3),
            growth_rate=round(0.032 + rng.uniform(0.0, 0.032), 5),
            mortality_rate=round(0.035 + rng.uniform(0.0, 0.035), 5),
            carrying_capacity=round(capacity, 3),
            region_ids=prey_regions[:8],
            prey_ids=[prey],
            labels={"en": en, "ar": ar},
        )
        events.append(
            make_event(
                planet_id,
                0,
                EventType.SPECIES_CREATED,
                "initial_food_web_seed",
                prey_regions[0] if prey_regions else None,
                0.92,
                {"population": species[sid].population},
                {"prey_population": species[prey].population},
                event_index,
                {"en": "Predator emerged", "ar": "ظهور مفترس"},
                {"species_id": sid, "prey_ids": [prey]},
            )
        )
        event_index += 1

    return species, events


def advance_ecosystem(state, event_index: int) -> list[SimulationEvent]:
    events: list[SimulationEvent] = []
    species = state.species
    regions = state.regions
    plant_biomass = sum(sp.biomass for sp in species.values() if sp.kind == "plant")
    herbivore_biomass = sum(sp.biomass for sp in species.values() if sp.kind == "herbivore")

    for sp in sorted(species.values(), key=lambda item: item.id):
        if not sp.region_ids or sp.population <= 0:
            continue
        region_quality = sum(
            regions[rid].fertility * (1.0 - regions[rid].pollution) for rid in sp.region_ids if rid in regions
        ) / max(1, len(sp.region_ids))
        if sp.kind == "plant":
            carrying = max(10.0, sp.carrying_capacity * (0.55 + region_quality))
            growth = sp.growth_rate * sp.population * (1.0 - sp.population / carrying)
            loss = sp.mortality_rate * (0.7 + 0.8 * average_drought(regions, sp.region_ids)) * sp.population
            sp.population = round(max(0.0, sp.population + growth - loss), 6)
            sp.biomass = round(max(0.0, sp.biomass + growth * 1.4 - loss), 6)
            spread = maybe_spread_plant(sp, regions)
            if spread:
                events.append(
                    make_event(
                        state.planet_id,
                        state.tick,
                        EventType.PLANT_SPREAD,
                        f"species:{sp.id}",
                        spread,
                        0.74,
                        {"fertility": 0.012, "plant_population": sp.population},
                        {"moisture": 0.004},
                        event_index + len(events),
                        {"en": "Plant spread", "ar": "انتشار نبات"},
                        {"species_id": sp.id},
                    )
                )
        elif sp.kind == "herbivore":
            food_pressure = plant_biomass / max(1.0, plant_biomass + sp.population * 4.0)
            predation = herbivore_biomass / max(1.0, herbivore_biomass + sp.population * 3.5)
            delta = sp.population * (sp.growth_rate * food_pressure - sp.mortality_rate * (0.6 + predation))
            sp.population = round(max(0.0, sp.population + delta), 6)
            sp.biomass = round(max(0.0, sp.population * 0.85), 6)
        else:
            prey_population = sum(species[p].population for p in sp.prey_ids if p in species)
            prey_factor = prey_population / max(1.0, prey_population + sp.population * 6.0)
            delta = sp.population * (sp.growth_rate * prey_factor - sp.mortality_rate * 0.82)
            sp.population = round(max(0.0, sp.population + delta), 6)
            sp.biomass = round(max(0.0, sp.population * 0.72), 6)

        pressure = 1.0 - min(1.0, sp.population / max(1.0, sp.carrying_capacity))
        if pressure > 0.82 and state.tick % 37 == 0:
            sp.mutation_index = round(sp.mutation_index + pressure * 0.035, 6)
            events.append(
                make_event(
                    state.planet_id,
                    state.tick,
                    EventType.SPECIES_MUTATED,
                    f"adaptation_pressure:{sp.id}",
                    sp.region_ids[0],
                    0.68,
                    {"mutation_index": sp.mutation_index},
                    {"survival_pressure": pressure},
                    event_index + len(events),
                    {"en": "Species mutated", "ar": "طفرة نوع"},
                    {"species_id": sp.id},
                )
            )

        if 0 < sp.population < 5:
            sp.population = 0.0
            events.append(
                make_event(
                    state.planet_id,
                    state.tick,
                    EventType.SPECIES_EXTINCT,
                    f"population_collapse:{sp.id}",
                    sp.region_ids[0],
                    0.9,
                    {"population": -5.0},
                    {"food_web_pressure": pressure},
                    event_index + len(events),
                    {"en": "Species extinct", "ar": "انقراض نوع"},
                    {"species_id": sp.id},
                )
            )
    return events


def average_drought(regions: dict[str, Region], region_ids: list[str]) -> float:
    if not region_ids:
        return 0.0
    return sum(regions[rid].drought for rid in region_ids if rid in regions) / max(1, len(region_ids))


def maybe_spread_plant(sp: Species, regions: dict[str, Region]) -> str | None:
    if sp.population < sp.carrying_capacity * 0.58:
        return None
    existing = set(sp.region_ids)
    candidates: list[tuple[float, str]] = []
    for rid in sp.region_ids:
        for nid in regions[rid].neighbors:
            if nid in existing:
                continue
            nr = regions[nid]
            score = nr.fertility * (1.0 - nr.pollution) - nr.drought * 0.35
            if nr.biome not in {"ocean", "ice"} and score > 0.45:
                candidates.append((score, nid))
    if not candidates:
        return None
    _, chosen = sorted(candidates, key=lambda item: (-item[0], item[1]))[0]
    sp.region_ids.append(chosen)
    regions[chosen].fertility = round(clamp(regions[chosen].fertility + 0.012), 6)
    return chosen

