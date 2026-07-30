"""HTTP boundary contract tests."""
from fastapi.testclient import TestClient

from app.main import app

from .conftest import SMALL_PARAMS

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_meta_catalog():
    res = client.get("/meta")
    assert res.status_code == 200
    body = res.json()
    assert "WAR_STARTED" in body["eventTypes"]
    assert "plant" in body["contributionCategories"]


def test_generate_advance_inject_flow():
    gen = client.post("/generate", json={"seed": 9, "params": dict(SMALL_PARAMS)})
    assert gen.status_code == 200
    state = gen.json()["state"]
    assert gen.json()["hash"]

    adv = client.post("/advance", json={"state": state, "ticks": 5})
    assert adv.status_code == 200
    state2 = adv.json()["state"]
    assert state2["meta"]["tick"] == state["meta"]["tick"] + 5

    inj = client.post("/inject", json={
        "state": state2,
        "contribution": {"category": "plant", "name": "API Flora", "traits": {"growthRate": 0.5}},
    })
    assert inj.status_code == 200
    body = inj.json()
    assert body["assessment"]["successProbability"] >= 0
    assert body["events"]


def test_assess_and_scenarios():
    gen = client.post("/generate", json={"seed": 11, "params": dict(SMALL_PARAMS)})
    state = gen.json()["state"]
    res = client.post("/assess", json={
        "state": state,
        "contribution": {"category": "creature", "name": "Sky Grazer",
                         "traits": {"size": 0.6, "aggression": 0.2}},
    })
    assert res.status_code == 200

    sc = client.post("/scenarios", json={"state": state, "horizons": [1], "runs": 2})
    assert sc.status_code == 200
    assert sc.json()["report"]["probabilistic"]


def test_maps_endpoint():
    gen = client.post("/generate", json={"seed": 3, "params": dict(SMALL_PARAMS)})
    state = gen.json()["state"]
    res = client.post("/maps", json={"state": state, "layers": ["biome"], "scale": 1})
    assert res.status_code == 200
    assert "biome" in res.json()["layers"]


def test_replay_is_deterministic():
    payload = {"seed": 21, "ticks": 12, "params": dict(SMALL_PARAMS)}
    a = client.post("/replay", json=payload).json()
    b = client.post("/replay", json=payload).json()
    assert a["hash"] == b["hash"]


def test_invalid_state_rejected():
    res = client.post("/advance", json={"state": {"nope": True}, "ticks": 1})
    assert res.status_code == 422
