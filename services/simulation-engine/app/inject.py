"""User contribution injection.

Takes a *structured, validated* contribution (produced upstream by the
AI orchestrator and balanced) and applies it to the world with real
algorithmic placement: suitability scans pick the region, initial
populations derive from carrying capacity, and every consequence flows
through normal systems afterwards.
"""
from __future__ import annotations

from typing import Any

from . import biomes as B
from .common import clamp, grid_of
from .engine_util import best_cells_for
from .events import (
    CITY_CREATED,
    CIVILIZATION_FOUNDED,
    CLIMATE_CHANGED,
    CONTRIBUTION_APPLIED,
    DISEASE_OUTBREAK,
    PLANT_SPREAD,
    RESOURCE_DISCOVERED,
    SPECIES_CREATED,
    TECHNOLOGY_DISCOVERED,
    EventLog,
)
from .names import city_name, culture_name, language_name
from .rng import Rng

CATEGORIES = [
    "creature", "plant", "resource", "civilization", "invention",
    "natural_phenomenon", "disease", "culture", "world_law", "custom",
]


def inject_contribution(state: dict[str, Any], contribution: dict[str, Any]) -> dict[str, Any]:
    """Apply a contribution; returns the root events created."""
    meta = state["meta"]
    tick = meta["tick"]
    rng = Rng(meta["seed"], "inject", tick, contribution.get("name", "?"))
    log = EventLog(state)
    cid_value = contribution.get("id") or f"uc_{len(state['contributions'])}"
    category = contribution["category"]
    name = contribution["name"]
    traits = {k: clamp(float(v)) for k, v in (contribution.get("traits") or {}).items()}

    state["contributions"][cid_value] = {
        "id": cid_value,
        "category": category,
        "name": name,
        "traits": traits,
        "appliedTick": tick,
    }

    handler = _HANDLERS.get(category, _apply_custom)
    root_events = handler(state, contribution, traits, rng, log, tick, cid_value)
    return {"contributionId": cid_value, "events": root_events, "state": state}


# ---------------------------------------------------------------------
# Category handlers
# ---------------------------------------------------------------------

def _apply_plant(state, contribution, traits, rng, log, tick, cid):
    cells = state["cells"]
    plant_traits = {
        "size": traits.get("size", 0.5),
        "growthRate": traits.get("growthRate", 0.5),
        "waterNeed": traits.get("waterNeed", 0.5),
        "coldRes": traits.get("coldResistance", traits.get("coldRes", 0.5)),
        "heatRes": traits.get("heatResistance", traits.get("heatRes", 0.5)),
        "pollutionAbsorption": traits.get("pollutionAbsorption", 0.2),
        "energyStorage": traits.get("energyStorage", 0.3),
        "luminosity": traits.get("nightLuminosity", traits.get("luminosity", 0.0)),
        "nutrition": traits.get("nutrition", 0.5),
        "toxicity": traits.get("toxicity", 0.0),
        "spreadRate": traits.get("spreadRate", 0.4),
    }
    target = contribution.get("targetCellId")
    origins = best_cells_for(state, lambda c: _plant_fit(state, plant_traits, c),
                             around=target, count=3, rng=rng)
    pid = f"pl_{len(state['plants'])}"
    presence = {str(c): 0.35 for c in origins}
    state["plants"][pid] = {
        "id": pid, "name": contribution["name"],
        "homeBiome": cells[origins[0]]["biome"] if origins else B.PLAINS,
        "traits": plant_traits, "presence": presence, "extinct": False,
        "contributionId": cid,
    }
    evt = log.emit(tick, PLANT_SPREAD, importance=4, cell_id=origins[0] if origins else None,
                   plant_ids=[pid], contribution_id=cid,
                   payload={"name": contribution["name"], "genesis": "contribution",
                            "initialCells": origins})
    return [evt]


def _apply_creature(state, contribution, traits, rng, log, tick, cid):
    sp_traits = {
        "size": traits.get("size", 0.4),
        "reproductionRate": traits.get("reproductionRate", 0.4),
        "diet": traits.get("diet", "herbivore"),
        "tempMin": traits.get("tempMin", -5.0),
        "tempMax": traits.get("tempMax", 35.0),
        "waterNeed": traits.get("waterNeed", 0.5),
        "intelligence": traits.get("intelligence", 0.3),
        "aggression": traits.get("aggression", 0.4),
        "speed": traits.get("speed", 0.5),
        "adaptability": traits.get("adaptability", 0.5),
        "mutationRate": traits.get("mutationRate", 0.06),
        "sociality": traits.get("sociality", 0.5),
    }
    target = contribution.get("targetCellId")
    origins = best_cells_for(state, lambda c: _creature_fit(state, sp_traits, c),
                             around=target, count=2, rng=rng)
    sid = f"sp_{len(state['species'])}"
    pops = {str(c): 60.0 for c in origins}
    state["species"][sid] = {
        "id": sid, "name": contribution["name"], "traits": sp_traits,
        "homeCell": origins[0] if origins else 0, "prey": [],
        "populations": pops, "extinct": False, "contributionId": cid,
    }
    evt = log.emit(tick, SPECIES_CREATED, importance=4,
                   cell_id=origins[0] if origins else None, species_ids=[sid],
                   contribution_id=cid,
                   payload={"name": contribution["name"], "genesis": "contribution",
                            "diet": sp_traits["diet"]})
    return [evt]


def _apply_resource(state, contribution, traits, rng, log, tick, cid):
    cells = state["cells"]
    rid = f"res_{len(state['resources'])}"
    preferred = [b for b in (contribution.get("possibleBiomes") or []) if b in B.ALL_BIOMES]
    target = contribution.get("targetCellId")
    candidates = best_cells_for(
        state,
        lambda c: B.is_land(c["biome"]) and (not preferred or c["biome"] in preferred),
        around=target, count=4, rng=rng,
    )
    state["resources"][rid] = {
        "id": rid, "name": contribution["name"],
        "kind": traits.get("kind", "material"),
        "baseValue": 0.5 + traits.get("value", 0.5) * 3.0,
        "regen": traits.get("renewable", 0.0) * 0.05,
        "envImpact": traits.get("envImpact", 0.3),
        "contributionId": cid,
    }
    qty = 80.0 + traits.get("abundance", 0.5) * 220.0
    evts = []
    for c in candidates:
        cells[c]["deposits"][rid] = round(qty * rng.uniform(0.5, 1.0), 1)
        evts.append(log.emit(tick, RESOURCE_DISCOVERED, importance=3, cell_id=c,
                             contribution_id=cid,
                             payload={"resource": rid, "name": contribution["name"],
                                      "quantity": cells[c]["deposits"][rid]}))
    return evts


def _apply_civilization(state, contribution, traits, rng, log, tick, cid):
    cells = state["cells"]
    target = contribution.get("targetCellId")
    origins = best_cells_for(
        state,
        lambda c: B.is_habitable(c["biome"]) and c["owner"] is None and c["fertility"] > 0.25,
        around=target, count=1, rng=rng,
    )
    if not origins:
        return [log.emit(tick, CONTRIBUTION_APPLIED, importance=2, contribution_id=cid,
                         payload={"name": contribution["name"], "result": "no_suitable_site"})]
    site = origins[0]
    civ_id = f"civ_{len(state['civilizations'])}"
    city_id = f"city_{len(state['cities'])}"
    pop = int(400 + traits.get("population", 0.4) * 1200)
    civ = {
        "id": civ_id, "name": contribution["name"],
        "culture": culture_name(rng), "language": language_name(rng),
        "government": traits.get("government", "tribal_council"),
        "population": pop, "techLevel": int(1 + traits.get("techLevel", 0) * 2),
        "techProgress": 0.0, "military": 40 + traits.get("military", 0.3) * 80,
        "treasury": 80.0, "food": 400.0, "happiness": 0.6, "health": 0.55,
        "stability": 0.65, "education": traits.get("education", 0.2),
        "pollutionOutput": 0.05,
        "personality": {
            "aggression": traits.get("aggression", 0.4),
            "innovation": traits.get("innovation", 0.5),
            "expansionism": traits.get("expansionism", 0.5),
            "mercantilism": traits.get("mercantilism", 0.5),
        },
        "cities": [city_id], "stockpiles": {}, "relationships": {}, "memory": [],
        "extinct": False, "contributionId": cid,
    }
    state["civilizations"][civ_id] = civ
    state["cities"][city_id] = {
        "id": city_id, "civId": civ_id, "cellId": site,
        "name": city_name(rng), "population": pop, "foundedTick": tick, "level": 1,
    }
    cells[site]["owner"] = civ_id
    cells[site]["cityId"] = city_id
    for nb in grid_of(state).neighbors(site):
        if B.is_land(cells[nb]["biome"]) and cells[nb]["owner"] is None:
            cells[nb]["owner"] = civ_id
    evt = log.emit(tick, CIVILIZATION_FOUNDED, importance=5, cell_id=site,
                   civ_ids=[civ_id], contribution_id=cid,
                   payload={"name": civ["name"], "genesis": "contribution"})
    evt2 = log.emit(tick, CITY_CREATED, importance=3, cell_id=site, civ_ids=[civ_id],
                    cause_event_id=evt["id"], contribution_id=cid,
                    payload={"name": state["cities"][city_id]["name"], "capital": True})
    return [evt, evt2]


def _apply_invention(state, contribution, traits, rng, log, tick, cid):
    # a technology enters the world's discovery frontier; most innovative
    # civ gets it first after a research lag encoded as pending effect
    tid = f"tech_{len(state['technologies'])}"
    tier = int(1 + traits.get("complexity", 0.5) * 3)
    state["technologies"][tid] = {
        "id": tid, "name": contribution["name"], "tier": tier,
        "discoveredBy": None, "tick": None, "contributionId": cid,
        "progressRequired": 40 + tier * 50,
    }
    best = None
    best_inno = -1.0
    from .common import alive_civs
    for civ in alive_civs(state):
        if civ["personality"]["innovation"] > best_inno:
            best, best_inno = civ, civ["personality"]["innovation"]
    if best is not None:
        best["techProgress"] += state["technologies"][tid]["progressRequired"]
    evt = log.emit(tick, TECHNOLOGY_DISCOVERED, importance=4, contribution_id=cid,
                   civ_ids=[best["id"]] if best else [],
                   payload={"tech": contribution["name"], "tier": tier,
                            "genesis": "contribution",
                            "firstAdopter": best["name"] if best else None})
    return [evt]


def _apply_phenomenon(state, contribution, traits, rng, log, tick, cid):
    from .engine import schedule_effect
    grid = grid_of(state)
    target = contribution.get("targetCellId")
    if target is None:
        target = rng.randint(0, len(state["cells"]) - 1)
    region = [target] + grid.neighbors(target, diagonal=True)
    for ring in range(2):
        region += [n for c in list(region) for n in grid.neighbors(c, diagonal=True)]
    region = sorted(set(region))
    moisture_delta = traits.get("moistureDelta", 0.0) - 0.0
    if "rainfulness" in traits:
        moisture_delta = traits["rainfulness"] * 0.2
    temp_delta = traits.get("tempDelta", 0.0)
    if "warmth" in traits:
        temp_delta = traits["warmth"] * 3.0
    if "coldness" in traits:
        temp_delta = -traits["coldness"] * 3.0
    for pulse in range(1, 5):
        schedule_effect(state, tick + pulse * 2, "weather_pattern", {
            "cells": region, "moistureDelta": moisture_delta, "tempDelta": temp_delta,
            "contributionId": cid, "name": contribution["name"],
        }, cause_event_id=None)
    evt = log.emit(tick, CLIMATE_CHANGED, importance=4, cell_id=target, contribution_id=cid,
                   payload={"driver": "phenomenon", "name": contribution["name"],
                            "regionCells": len(region)})
    return [evt]


def _apply_disease(state, contribution, traits, rng, log, tick, cid):
    target = contribution.get("targetCellId")
    if target is None:
        cities = sorted(state["cities"].values(), key=lambda c: -c["population"])
        target = cities[0]["cellId"] if cities else 0
    did = f"dis_{len(state['diseases'])}"
    owner = state["cells"][target]["owner"]
    state["diseases"][did] = {
        "id": did, "originCity": state["cells"][target]["cityId"], "originCell": target,
        "severity": 0.1 + traits.get("severity", 0.3) * 0.5,
        "transmission": 0.2 + traits.get("transmission", 0.4) * 0.5,
        "civs": [owner] if owner else [], "cells": [target],
        "startTick": tick, "active": True, "contributionId": cid,
    }
    evt = log.emit(tick, DISEASE_OUTBREAK, importance=4, cell_id=target,
                   civ_ids=[owner] if owner else [], contribution_id=cid,
                   payload={"disease": did, "name": contribution["name"],
                            "severity": state["diseases"][did]["severity"]})
    return [evt]


def _apply_culture(state, contribution, traits, rng, log, tick, cid):
    from .common import alive_civs
    influence = traits.get("influence", 0.5)
    affected = []
    for civ in alive_civs(state):
        civ["happiness"] = clamp(civ["happiness"] + influence * 0.1)
        civ["education"] = clamp(civ["education"] + influence * 0.05)
        affected.append(civ["id"])
        if len(affected) >= 6:
            break
    evt = log.emit(tick, "CULTURE_EVOLVED", importance=3, civ_ids=affected, contribution_id=cid,
                   payload={"culture": contribution["name"], "influence": influence})
    return [evt]


def _apply_world_law(state, contribution, traits, rng, log, tick, cid):
    from .engine import schedule_effect
    factor = 1.0 + traits.get("photosynthesisBoost", traits.get("potency", 0.2)) * 0.3
    schedule_effect(state, tick + 1, "world_law", {
        "vegetationFactor": factor, "name": contribution["name"], "contributionId": cid,
    }, cause_event_id=None)
    state["meta"]["co2"] = max(0.6, state["meta"]["co2"] - traits.get("cleanAir", 0.0) * 0.1)
    evt = log.emit(tick, CONTRIBUTION_APPLIED, importance=4, contribution_id=cid,
                   payload={"name": contribution["name"], "kind": "world_law",
                            "vegetationFactor": round(factor, 3)})
    return [evt]


def _apply_custom(state, contribution, traits, rng, log, tick, cid):
    # custom elements map to the closest measurable effect: a durable
    # fertility/pollution imprint on the target region
    target = contribution.get("targetCellId")
    if target is None or not (0 <= int(target) < len(state["cells"])):
        target = rng.randint(0, len(state["cells"]) - 1)
    cell = state["cells"][int(target)]
    fertility_delta = traits.get("benefit", 0.2) * 0.2
    cell["fertility"] = clamp(cell["fertility"] + fertility_delta)
    evt = log.emit(tick, CONTRIBUTION_APPLIED, importance=3, cell_id=int(target),
                   contribution_id=cid,
                   payload={"name": contribution["name"], "kind": "custom",
                            "fertilityDelta": round(fertility_delta, 3)})
    return [evt]


_HANDLERS = {
    "plant": _apply_plant,
    "creature": _apply_creature,
    "resource": _apply_resource,
    "civilization": _apply_civilization,
    "invention": _apply_invention,
    "natural_phenomenon": _apply_phenomenon,
    "disease": _apply_disease,
    "culture": _apply_culture,
    "world_law": _apply_world_law,
    "custom": _apply_custom,
}


def _plant_fit(state, traits, cell) -> float:
    from .generator import _plant_suitability
    eff = dict(cell)
    eff["temp"] = cell["temp"] + state["meta"].get("globalTempShift", 0.0)
    return _plant_suitability(traits, eff)


def _creature_fit(state, traits, cell) -> float:
    from .generator import species_suitability
    eff = dict(cell)
    eff["temp"] = cell["temp"] + state["meta"].get("globalTempShift", 0.0)
    return species_suitability(traits, eff)


def assess_contribution(state: dict[str, Any], contribution: dict[str, Any]) -> dict[str, Any]:
    """Algorithmic pre-flight assessment used by the preview step."""
    traits = {k: clamp(float(v)) for k, v in (contribution.get("traits") or {}).items()}
    category = contribution["category"]
    target = contribution.get("targetCellId")
    grid = grid_of(state)

    if category == "plant":
        t = {
            "waterNeed": traits.get("waterNeed", 0.5),
            "coldRes": traits.get("coldResistance", 0.5),
            "heatRes": traits.get("heatResistance", 0.5),
        }
        fits = [(c["id"], _plant_fit(state, t, c)) for c in state["cells"]]
        biome_fit: dict[str, list[float]] = {}
        for c in state["cells"]:
            biome_fit.setdefault(c["biome"], []).append(_plant_fit(state, t, c))
        fit_at = _plant_fit(state, t, state["cells"][target]) if target is not None else 0.0
        suitable = sorted(
            ((b, sum(v) / len(v)) for b, v in biome_fit.items() if B.is_land(b)),
            key=lambda kv: -kv[1],
        )[:4]
    elif category == "creature":
        t = {
            "tempMin": traits.get("tempMin", -5.0), "tempMax": traits.get("tempMax", 35.0),
            "waterNeed": traits.get("waterNeed", 0.5), "diet": traits.get("diet", "herbivore"),
            "adaptability": traits.get("adaptability", 0.5),
        }
        fit_at = _creature_fit(state, t, state["cells"][target]) if target is not None else 0.0
        suitable = []
    else:
        fit_at = 0.5
        suitable = []

    success = clamp(0.25 + fit_at * 0.75) if target is not None else clamp(0.35 + (suitable[0][1] if suitable else 0.4) * 0.5)
    risks: list[str] = []
    if traits.get("waterNeed", 0) >= 0.7:
        risks.append("high_water_consumption")
    if traits.get("growthRate", 0) > 0.75:
        risks.append("ecosystem_competition")
    if traits.get("aggression", 0) > 0.7:
        risks.append("predation_pressure")
    if traits.get("pollutionAbsorption", 0) > 0.8:
        risks.append("soil_chemistry_shift")
    if category in ("invention", "world_law"):
        risks.append("unintended_systemic_effects")

    return {
        "successProbability": round(success, 3),
        "fitAtTarget": round(fit_at, 3),
        "suitableBiomes": [{"biome": b, "fit": round(f, 3)} for b, f in suitable],
        "risks": risks,
        "shortTerm": _projection_text(category, success, horizon="short"),
        "longTerm": _projection_text(category, success, horizon="long"),
    }


def _projection_text(category: str, success: float, horizon: str) -> dict[str, Any]:
    spread = round(success * (0.6 if horizon == "short" else 1.4), 3)
    return {
        "spreadLikelihood": min(1.0, spread),
        "expectedEvents": {
            "plant": ["growth", "spread", "herbivore_adoption"],
            "creature": ["population_growth", "migration", "predation"],
            "resource": ["extraction", "trade", "possible_conflict"],
            "civilization": ["expansion", "diplomacy", "technology"],
            "invention": ["adoption", "industry_shift"],
            "natural_phenomenon": ["weather_shift", "harvest_change"],
            "disease": ["outbreak", "containment_effort"],
            "culture": ["influence_spread", "happiness_shift"],
            "world_law": ["global_adjustment"],
            "custom": ["local_imprint"],
        }.get(category, []),
        "horizon": horizon,
    }
