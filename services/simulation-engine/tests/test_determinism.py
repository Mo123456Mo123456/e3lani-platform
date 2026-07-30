"""Invariant #1/#2: same seed reproduces identical history; replaying
events reproduces identical state."""
import json

from app.engine import advance, run_history
from app.generator import generate_world
from app.rng import hash_state

from .conftest import SMALL_PARAMS


def test_same_seed_same_world():
    a = generate_world(123, dict(SMALL_PARAMS))
    b = generate_world(123, dict(SMALL_PARAMS))
    assert hash_state(a) == hash_state(b)


def test_different_seed_different_world():
    a = generate_world(123, dict(SMALL_PARAMS))
    b = generate_world(124, dict(SMALL_PARAMS))
    assert hash_state(a) != hash_state(b)


def test_same_seed_same_history():
    a = generate_world(55, dict(SMALL_PARAMS))
    b = generate_world(55, dict(SMALL_PARAMS))
    advance(a, 40)
    advance(b, 40)
    assert hash_state(a) == hash_state(b)


def test_json_roundtrip_keeps_determinism():
    a = generate_world(55, dict(SMALL_PARAMS))
    advance(a, 15)
    restored = json.loads(json.dumps(a))
    advance(a, 10)
    advance(restored, 10)
    assert hash_state(a) == hash_state(restored)


def test_full_replay_reproduces_state():
    injection = {
        "tick": 10,
        "contribution": {
            "category": "plant",
            "name": "Test Flora",
            "traits": {"growthRate": 0.6, "waterNeed": 0.4},
        },
    }
    a = run_history(88, 30, [injection], dict(SMALL_PARAMS))
    b = run_history(88, 30, [injection], dict(SMALL_PARAMS))
    assert hash_state(a) == hash_state(b)


def test_event_ids_are_sequential(fresh_world):
    state, _ = advance(fresh_world, 20)
    ids = [int(e["id"].split("_")[1]) for e in state["events"]]
    assert ids == list(range(1, len(ids) + 1))
