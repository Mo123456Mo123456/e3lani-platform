import hashlib
import json

from app.engine import SimulationEngine


def canonical_hash(state) -> str:
    payload = state.model_dump(mode="json")
    payload.pop("snapshots", None)
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def test_same_seed_produces_identical_world_and_history(tmp_path):
    engine_a = SimulationEngine(tmp_path / "a")
    engine_b = SimulationEngine(tmp_path / "b")

    state_a = engine_a.generate_world("deterministic-seed", (18, 36))
    state_b = engine_b.generate_world("deterministic-seed", (18, 36))
    assert canonical_hash(state_a) == canonical_hash(state_b)

    engine_a.simulate_ticks(state_a.planet_id, ticks=6)
    engine_b.simulate_ticks(state_b.planet_id, ticks=6)

    assert canonical_hash(engine_a.get_state(state_a.planet_id)) == canonical_hash(engine_b.get_state(state_b.planet_id))

