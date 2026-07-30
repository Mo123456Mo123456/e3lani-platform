"""Provider adapter tests with mocked HTTP — no live keys needed."""
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.base import ProviderError
from app.providers.openai import OpenAIProvider
from app.schemas import Category


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class FakeClient:
    """Records requests and returns a canned response."""

    last_request = None
    response = FakeResponse()

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, **kwargs):
        FakeClient.last_request = {"url": url, **kwargs}
        return FakeClient.response


@pytest.mark.asyncio
async def test_openai_adapter_structured_output(monkeypatch):
    contribution = {
        "category": "plant",
        "name": "شجرة الضوء",
        "description": "test",
        "traits": {"size": 0.8, "pollutionAbsorption": 0.9},
        "possible_biomes": ["temperate_forest"],
        "risks": ["high_water_consumption"],
    }
    FakeClient.response = FakeResponse(200, {
        "choices": [{"message": {"content": json.dumps(contribution)}}]
    })
    monkeypatch.setattr("app.providers.openai.httpx.AsyncClient", FakeClient)

    provider = OpenAIProvider(api_key="test-key", model="gpt-4o-mini")
    result = await provider.parse_contribution("شجرة مضيئة", None, "ar")

    assert result.category == Category.plant
    assert result.traits["pollutionAbsorption"] == 0.9
    # the request must enforce structured output
    sent = FakeClient.last_request
    assert sent["json"]["response_format"]["type"] == "json_schema"
    assert sent["headers"]["authorization"] == "Bearer test-key"


@pytest.mark.asyncio
async def test_openai_adapter_http_error_raises_provider_error(monkeypatch):
    FakeClient.response = FakeResponse(500, text="boom")
    monkeypatch.setattr("app.providers.openai.httpx.AsyncClient", FakeClient)
    provider = OpenAIProvider(api_key="test-key")
    with pytest.raises(ProviderError):
        await provider.parse_contribution("text here", None, "ar")


@pytest.mark.asyncio
async def test_openai_adapter_malformed_json_raises(monkeypatch):
    FakeClient.response = FakeResponse(200, {"choices": [{"message": {"content": "not json"}}]})
    monkeypatch.setattr("app.providers.openai.httpx.AsyncClient", FakeClient)
    provider = OpenAIProvider(api_key="test-key")
    with pytest.raises(ProviderError):
        await provider.parse_contribution("text here", None, "ar")


def test_service_falls_back_to_mock_on_provider_failure(monkeypatch):
    class FailingProvider:
        name = "openai"

        async def parse_contribution(self, text, category, locale):
            raise ProviderError("simulated outage")

        async def narrate(self, name, facts, locale):
            raise ProviderError("simulated outage")

    with TestClient(app) as client:
        app.state.provider = FailingProvider()
        body = client.post("/v1/parse-contribution", json={
            "text": "شجرة تمتص التلوث",
            "locale": "ar",
        })
        assert body.status_code == 200
        payload = body.json()
        # degraded honestly: the response says the mock produced it
        assert payload["provider"] == "mock"
        assert payload["sandbox"] is True
        assert payload["structured"]["category"] == "plant"
