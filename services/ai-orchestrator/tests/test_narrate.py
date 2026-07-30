from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_narrate_empty_events_does_not_invent_outcomes() -> None:
    response = client.post("/narrate", json={"events": [], "metrics": {}, "locale": "en"})

    assert response.status_code == 200
    body = response.json()
    assert body["used_event_count"] == 0
    assert "No simulation results yet" in body["story"]
    assert "war" not in body["story"].lower()
    assert "extinction" not in body["story"].lower()


def test_narrate_uses_only_provided_event_and_metric_facts() -> None:
    response = client.post(
        "/narrate",
        json={
            "events": [
                {
                    "type": "SPECIES_CREATED",
                    "title": "Glow moss spread",
                    "tick": 12,
                    "regionId": "north-plain",
                }
            ],
            "metrics": {"population": 42, "pollution": 0.2},
            "locale": "en",
        },
    )

    assert response.status_code == 200
    story = response.json()["story"]
    assert "SPECIES_CREATED" in story
    assert "Glow moss spread" in story
    assert "population: 42" in story
    assert "pollution: 0.2" in story
    assert "war" not in story.lower()
    assert "extinct" not in story.lower()
