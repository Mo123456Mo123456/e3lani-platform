from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


client = TestClient(app)


def test_parse_arabic_pollution_light_plant_uses_sandbox() -> None:
    get_settings.cache_clear()
    response = client.post(
        "/parse",
        json={
            "text": "أنشئ نباتا مضيئا يمتص التلوث في الصحراء",
            "locale": "ar",
        },
    )

    assert response.status_code == 200
    body = response.json()
    element = body["element"]
    assert body["provider"] == "sandbox"
    assert body["sandbox"] is True
    assert element["category"] == "plant"
    assert element["traits"]["pollutionAbsorption"] >= 0.75
    assert element["traits"]["nightLuminosity"] >= 0.75
    assert "desert" in element["possibleBiomes"]
    assert body["moderation"]["allowed"] is True


def test_parse_respects_category_hint() -> None:
    response = client.post(
        "/parse",
        json={
            "text": "A gentle crystal that stores solar power near mountains",
            "locale": "en",
            "category_hint": "energy",
        },
    )

    assert response.status_code == 200
    element = response.json()["element"]
    assert element["category"] == "energy"
    assert element["traits"]["energyOutput"] >= 0.7
    assert "mountain" in element["possibleBiomes"]


def test_missing_external_provider_key_falls_back_to_sandbox(monkeypatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_settings.cache_clear()

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "sandbox"
    assert body["sandbox"] is True
    get_settings.cache_clear()
