"""Regression: creature injection with enumerated + unbounded traits."""
from app.engine import advance
from app.inject import inject_contribution


def test_creature_with_diet_and_temp_range(fresh_world):
    result = inject_contribution(fresh_world, {
        "category": "creature",
        "name": "Tundra Grazer",
        "traits": {
            "diet": "herbivore",
            "tempMin": -20.0,
            "tempMax": 5.0,
            "size": 0.7,
            "aggression": 0.1,
        },
    })
    sid = next(s for s in fresh_world["species"].values() if s["contributionId"] == result["contributionId"])
    assert sid["traits"]["diet"] == "herbivore"
    assert sid["traits"]["tempMin"] == -20.0
    assert sid["traits"]["tempMax"] == 5.0
    # survives some ticks in its cold habitat
    advance(fresh_world, 8)
    assert not sid["extinct"] or sid["populations"] == {}
