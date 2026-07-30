from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _base_element(description: str) -> dict:
    return {
        "category": "creature",
        "name": "Overpowered creature",
        "description": description,
        "traits": {
            "size": 0.95,
            "growthRate": 0.95,
            "waterNeed": 0.5,
            "heatResistance": 0.5,
            "coldResistance": 0.5,
            "energyOutput": 1.0,
            "fertility": 1.0,
            "adaptability": 1.0,
        },
        "possibleBiomes": ["plains"],
        "risks": [],
        "benefits": ["Adds test value"],
        "balanceScore": 0.1,
        "wasBalanced": False,
    }


def test_balance_nerfs_immortal_infinite_energy_and_reproduction() -> None:
    response = client.post(
        "/balance",
        json={
            "element": _base_element(
                "An immortal creature with infinite energy and unlimited reproduction."
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    element = body["element"]
    assert body["rejected"] is False
    assert element["wasBalanced"] is True
    assert element["traits"]["energyOutput"] <= 0.85
    assert element["traits"]["fertility"] <= 0.85
    assert element["traits"]["adaptability"] <= 0.85
    assert any("infinite energy" in note.lower() for note in body["notes"])
    assert any("unlimited reproduction" in note.lower() for note in body["notes"])


def test_balance_rejects_absolute_planetary_control_scope() -> None:
    response = client.post(
        "/balance",
        json={
            "element": _base_element(
                "A ruler with absolute control that can cancel all laws."
            )
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rejected"] is True
    assert body["element"]["wasBalanced"] is True
    assert any("absolute control" in note.lower() for note in body["notes"])
    assert any("canceling all laws" in note.lower() for note in body["notes"])
