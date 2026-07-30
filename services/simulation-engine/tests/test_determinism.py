"""Determinism, rebuild, and causal integrity tests."""

from __future__ import annotations

import copy

import pytest

from app.causal import CausalGraph
from app.engine import TickEngine
from app.world import generate_world


def test_same_seed_same_world():
    a = generate_world("p1", 12345, width=16, height=16)
    b = generate_world("p1", 12345, width=16, height=16)
    assert a.elevation.tolist() == b.elevation.tolist()
    assert a.temperature.tolist() == b.temperature.tolist()
    assert a.biomes == b.biomes
    assert a.species == b.species


def test_same_seed_same_ticks():
    e1 = TickEngine()
    e2 = TickEngine()
    e1.create_or_get("alpha", 99, width=16, height=16)
    e2.create_or_get("alpha", 99, width=16, height=16)
    r1 = e1.run_ticks("alpha", 5)
    r2 = e2.run_ticks("alpha", 5)
    assert r1["summary"]["species"] == r2["summary"]["species"]
    assert r1["summary"]["mean_temperature"] == r2["summary"]["mean_temperature"]
    assert r1["summary"]["mean_pollution"] == r2["summary"]["mean_pollution"]
    assert e1.worlds["alpha"].snapshot()["civs"] == e2.worlds["alpha"].snapshot()["civs"]


def test_different_seed_diverges():
    e1 = TickEngine()
    e2 = TickEngine()
    e1.create_or_get("a", 1, width=16, height=16)
    e2.create_or_get("a", 2, width=16, height=16)
    s1 = e1.worlds["a"].snapshot()
    s2 = e2.worlds["a"].snapshot()
    assert s1["elevation"] != s2["elevation"]


def test_rebuild_restores_state():
    eng = TickEngine()
    eng.create_or_get("rebuild-me", 777, width=16, height=16)
    eng.inject_element(
        "rebuild-me",
        {
            "name": "Crystal Moss",
            "category": "flora",
            "traits": {"fertility": 0.6, "toxicity": 0.1},
            "possibleBiomes": ["forest"],
            "risks": ["bloom"],
        },
    )
    eng.run_ticks("rebuild-me", 4)
    before = copy.deepcopy(eng.worlds["rebuild-me"].snapshot())
    before_summary = eng.worlds["rebuild-me"].summary()

    eng.rebuild("rebuild-me", 777, width=16, height=16)
    after = eng.worlds["rebuild-me"].snapshot()
    after_summary = eng.worlds["rebuild-me"].summary()

    assert before["tick"] == after["tick"]
    assert before["species"] == after["species"]
    assert before["markets"] == after["markets"]
    assert before_summary["mean_pollution"] == after_summary["mean_pollution"]
    assert before["injected"][0]["name"] == after["injected"][0]["name"]


def test_no_causeless_events():
    eng = TickEngine()
    eng.create_or_get("causal", 42, width=16, height=16)
    eng.inject_element(
        "causal",
        {"name": "Storm Seed", "category": "weather", "traits": {"greenhouse": 0.4}},
    )
    eng.run_ticks("causal", 3)
    graph = eng.graphs["causal"]
    assert graph.validate_no_causeless()
    assert all(bool(e.get("cause")) for e in eng.event_logs["causal"])
    for node in graph.to_list():
        assert node["cause"]


def test_causal_graph_rejects_causeless():
    g = CausalGraph()
    with pytest.raises(ValueError, match="Causeless"):
        g.add(tick=1, event_type="bad", cause="", effect={})
    with pytest.raises(ValueError, match="Causeless"):
        g.ingest_events(1, [{"type": "x", "cause": "", "effect": {}}])


def test_forecast_runs_without_mutating_primary():
    eng = TickEngine()
    eng.create_or_get("fc", 5, width=16, height=16)
    eng.run_ticks("fc", 2)
    snap_before = copy.deepcopy(eng.worlds["fc"].snapshot())
    result = eng.forecast("fc", ticks=3, samples=4)
    assert result["samples"] == 4
    assert len(result["trajectories"]) == 4
    assert eng.worlds["fc"].snapshot() == snap_before
