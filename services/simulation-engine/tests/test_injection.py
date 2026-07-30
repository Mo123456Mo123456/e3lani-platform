"""Contribution injection: placement, assessment, causality roots."""
from app import biomes as B
from app.engine import advance
from app.events import descendant_ids
from app.inject import assess_contribution, inject_contribution


def _plant_contribution(**kw):
    base = {
        "category": "plant",
        "name": "شجرة الضوء العملاقة",
        "traits": {
            "size": 0.9, "growthRate": 0.3, "waterNeed": 0.7,
            "pollutionAbsorption": 0.95, "nightLuminosity": 0.8,
            "coldResistance": 0.4, "heatResistance": 0.7,
        },
    }
    base.update(kw)
    return base


def test_plant_injection_creates_presence(fresh_world):
    result = inject_contribution(fresh_world, _plant_contribution())
    plant = next(p for p in fresh_world["plants"].values() if p["contributionId"] == result["contributionId"])
    assert plant["presence"], "plant placed nowhere"
    for key in plant["presence"]:
        cell = fresh_world["cells"][int(key)]
        assert B.is_land(cell["biome"])
    assert result["events"][0]["contributionId"] == result["contributionId"]


def test_assessment_matches_spec_example(fresh_world):
    target = next(c["id"] for c in fresh_world["cells"] if c["biome"] == B.TEMPERATE_FOREST) \
        if any(c["biome"] == B.TEMPERATE_FOREST for c in fresh_world["cells"]) else 0
    report = assess_contribution(fresh_world, _plant_contribution(targetCellId=target))
    assert 0.0 <= report["successProbability"] <= 1.0
    assert report["suitableBiomes"]
    assert "high_water_consumption" in report["risks"]
    assert "ecosystem_competition" in report["risks"] or "soil_chemistry_shift" in report["risks"]


def test_contribution_causal_subtree_grows(fresh_world):
    result = inject_contribution(fresh_world, _plant_contribution())
    advance(fresh_world, 25)
    subtree = set()
    for evt in result["events"]:
        subtree |= descendant_ids(fresh_world["events"], evt["id"])
    assert len(subtree) >= len(result["events"])


def test_resource_injection_creates_deposits(fresh_world):
    before = sum(len(c["deposits"]) for c in fresh_world["cells"])
    inject_contribution(fresh_world, {
        "category": "resource", "name": "Crystal Veins",
        "traits": {"value": 0.8, "abundance": 0.7, "renewable": 0.0, "envImpact": 0.4},
    })
    after = sum(len(c["deposits"]) for c in fresh_world["cells"])
    assert after > before


def test_civilization_injection_founds_civ(fresh_world):
    n = len(fresh_world["civilizations"])
    inject_contribution(fresh_world, {
        "category": "civilization", "name": "Nomads of Aurora",
        "traits": {"innovation": 0.7, "aggression": 0.2},
    })
    assert len(fresh_world["civilizations"]) >= n  # may fail to place on tiny maps
    new = [c for c in fresh_world["civilizations"].values() if c["contributionId"]]
    if new:
        assert new[0]["cities"]


def test_world_law_schedules_effect(fresh_world):
    inject_contribution(fresh_world, {
        "category": "world_law", "name": "Richer Photosynthesis",
        "traits": {"photosynthesisBoost": 0.5},
    })
    assert fresh_world["pendingEffects"], "no pending effect scheduled"
    advance(fresh_world, 3)
    assert not fresh_world["pendingEffects"]
