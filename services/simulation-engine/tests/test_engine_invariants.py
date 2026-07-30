"""Invariants #3/#4/#6/#7: no civ without means, no causeless events,
population bounded by capacity, no impossible migrations."""
from app import biomes as B
from app.common import alive_civs, civ_capacity
from app.engine import advance

CAUSELESS_ALLOWED = {"WORLD_GENESIS"}


def _run(state, ticks):
    return advance(state, ticks)


def test_no_civilization_without_cities_or_land(fresh_world):
    state, _ = _run(fresh_world, 60)
    for civ in alive_civs(state):
        assert civ["cities"], f"{civ['id']} alive without cities"
        for city_id in civ["cities"]:
            assert city_id in state["cities"]


EXPLANATION_KEYS = ("reason", "cause", "causes", "driver", "genesis", "result")


def test_no_event_without_cause(fresh_world):
    state, _ = _run(fresh_world, 60)
    for evt in state["events"]:
        explained = any(k in evt["payload"] for k in EXPLANATION_KEYS)
        is_root = (
            evt["type"] in CAUSELESS_ALLOWED
            or evt["causeEventId"] is not None
            or evt["contributionId"] is not None
            or evt["tick"] == 0  # genesis batch
        )
        assert is_root or explained, f"causeless event: {evt['type']} #{evt['id']} {evt['payload']}"


def test_population_within_capacity(fresh_world):
    state, _ = _run(fresh_world, 60)
    for civ in alive_civs(state):
        cap = civ_capacity(state, civ) * 2.5 + 1000  # soft cap with bonuses
        assert civ["population"] <= cap, f"{civ['id']} population exceeds capacity"


def test_migrations_stay_on_land(fresh_world):
    state, _ = _run(fresh_world, 60)
    for mig in state["migrations"]:
        assert B.is_land(state["cells"][mig["toCell"]]["biome"])
        assert mig["size"] > 0


def test_wars_have_structured_causes(fresh_world):
    from app.systems.conflicts import WAR_THRESHOLD
    state, _ = _run(fresh_world, 60)
    for evt in state["events"]:
        if evt["type"] == "WAR_STARTED":
            assert evt["payload"]["causes"], "war without declared causes"
            assert evt["payload"]["score"] >= WAR_THRESHOLD


def test_world_remains_habitable_baseline(fresh_world):
    state, _ = _run(fresh_world, 60)
    alive_species = sum(1 for s in state["species"].values() if not s["extinct"])
    assert alive_species > 0
    assert any(True for _ in alive_civs(state)) or len(state["events"]) > 0
