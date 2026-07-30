from app.engine import SimulationEngine
from app.events import EventType
from app.models import StructuredElement


def test_contribution_changes_region_and_emits_causal_events(tmp_path):
    engine = SimulationEngine(tmp_path)
    state = engine.generate_world("contribution-seed", (18, 36))
    region = next(
        r
        for r in sorted(state.regions.values(), key=lambda item: item.id)
        if r.biome not in {"ocean", "ice", "mountain"}
    )
    before_fertility = region.fertility
    before_moisture = region.moisture

    contribution = StructuredElement(
        type="forest_garden",
        name="Community Forest / غابة مجتمعية",
        category="ecology",
        properties={"scale": 2.0},
    )
    record, updated = engine.apply_contribution(state.planet_id, contribution, region.id, "user-1")
    after = updated.regions[region.id]

    assert record.id in updated.contributions
    assert after.fertility > before_fertility
    assert after.moisture > before_moisture
    assert record.effects["fertility"] > 0
    assert record.effects["pollution"] < 0
    assert len(record.affected_regions) > 1
    emitted_types = {event.type for event in updated.events if event.id in record.event_ids}
    assert EventType.CONTRIBUTION_APPLIED in emitted_types
    assert EventType.PLANT_SPREAD in emitted_types
    assert any(edge.source == record.id and edge.target == region.id for edge in updated.causal_edges)

