import pytest

from app.generator import generate_world

SMALL_PARAMS = {
    "latBands": 12,
    "lonBands": 24,
    "civilizations": 4,
    "species": 40,
    "plants": 60,
    "deposits": 30,
    "rivers": 12,
}


@pytest.fixture(scope="session")
def small_world():
    return generate_world(7, dict(SMALL_PARAMS))


@pytest.fixture()
def fresh_world():
    return generate_world(7, dict(SMALL_PARAMS))
