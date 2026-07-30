from app import causal
from app.engine import SimulationEngine
from app.models import StructuredElement


def test_causal_graph_contains_paths_from_contribution_to_regions_and_civ(tmp_path):
    engine = SimulationEngine(tmp_path)
    state = engine.generate_world("causal-seed", (18, 36))
    region = next(r for r in state.regions.values() if r.owner_civ_id)
    before_freshwater = region.resources.get("freshwater", 0.0)
    contribution = StructuredElement(
        type="water_cleanup",
        name="River cleanup / تنظيف النهر",
        properties={"scale": 1.5},
    )

    record, updated = engine.apply_contribution(state.planet_id, contribution, region.id, "user-causal")
    graph = causal.build_region_causal_graph(updated)
    paths = causal.causal_paths_from_contribution(updated, record.id)

    assert graph.has_edge(record.id, region.id)
    assert any(path["target"] == region.id for path in paths)
    assert any(path["target"] == region.owner_civ_id for path in paths)
    assert updated.regions[region.id].resources["freshwater"] > before_freshwater

