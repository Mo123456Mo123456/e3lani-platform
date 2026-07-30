from app.engine import SimulationEngine
from app.world_generator import BIOMES


def test_world_generation_has_required_biomes_and_initial_entities(tmp_path):
    engine = SimulationEngine(tmp_path)
    state = engine.generate_world("world-gen-seed", (24, 48))

    biomes = {region.biome for region in state.regions.values()}
    assert biomes.issubset(set(BIOMES))
    assert {"ocean", "coast"}.issubset(biomes)
    assert len(biomes) >= 7
    assert len(state.civilizations) == 12
    assert len(state.cities) >= 12
    assert len(state.species) >= 30
    assert any(sp.kind == "plant" for sp in state.species.values())
    assert state.resources["_totals"]["food"] > 0
    assert state.resources["_totals"]["freshwater"] > 0
    assert len(state.trade_routes) > 0
    assert state.events

