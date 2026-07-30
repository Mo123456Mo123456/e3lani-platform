"""Structured-output tests: parsing, balance, narration constraint, providers."""
import pytest
from fastapi.testclient import TestClient

from app.balance import power_score, validate_balance
from app.main import app
from app.providers.mock import MockProvider
from app.schemas import Category, StructuredContribution


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_reports_mock_sandbox(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["provider"] == "mock"
    assert body["sandbox"] is True


def test_parse_arabic_light_tree(client):
    response = client.post("/v1/parse-contribution", json={
        "text": "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل",
        "locale": "ar",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["structured"]["category"] == "plant"
    assert body["structured"]["traits"]["pollutionAbsorption"] > 0.5
    assert body["structured"]["traits"]["nightLuminosity"] > 0.4
    assert body["provider"] == "mock"
    assert all(0 <= v <= 1 for v in body["structured"]["traits"].values())


def test_parse_is_deterministic(client):
    payload = {"text": "مخلوق طائر ذكي يعيش في الجبال", "locale": "ar"}
    a = client.post("/v1/parse-contribution", json=payload).json()
    b = client.post("/v1/parse-contribution", json=payload).json()
    assert a["structured"] == b["structured"]
    assert a["structured"]["category"] == "creature"
    assert "mountains" in a["structured"]["possible_biomes"]


def test_parse_english_invention(client):
    body = client.post("/v1/parse-contribution", json={
        "text": "a solar energy storage device, very valuable",
        "locale": "en",
        "category": "invention",
    }).json()
    assert body["structured"]["category"] == "invention"
    assert body["structured"]["traits"]["energyStorage"] >= 0.6


def test_balance_rejects_godmode():
    god = StructuredContribution(
        category=Category.creature,
        name="الخالد المطلق",
        traits={k: 1.0 for k in ["size", "lifespan", "reproductionRate", "adaptability", "toxicity", "intelligence", "aggression"]},
    )
    report = validate_balance(god)
    assert report.balanced is False
    assert report.suggested is not None
    assert power_score(report.suggested) < power_score(god)
    # the suggestion itself validates
    assert validate_balance(report.suggested).balanced is True


def test_narration_uses_only_provided_facts(client):
    facts = ["PLANT_SPREAD @ tick 12: vegetation expanded", "WAR_STARTED @ tick 40: resource competition"]
    body = client.post("/v1/narrate", json={
        "contribution_name": "شجرة الضوء",
        "locale": "ar",
        "facts": facts,
    }).json()
    for fact in facts:
        assert fact in body["text"]
    # no invented content beyond the facts template
    assert "انقرض" not in body["text"]


def test_invalid_input_rejected(client):
    assert client.post("/v1/parse-contribution", json={"text": "ab"}).status_code == 422


@pytest.mark.asyncio
async def test_mock_provider_directly():
    provider = MockProvider()
    result = await provider.parse_contribution("شجرة تمتص التلوث في الصحراء", None, "ar")
    assert result.category == Category.plant
    assert "desert" in [b.value for b in result.possible_biomes]
