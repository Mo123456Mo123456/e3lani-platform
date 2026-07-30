"""Generation correctness: structure, biomes, placement rules."""
from app import biomes as B
from app.events import WORLD_GENESIS

from .conftest import SMALL_PARAMS


def test_grid_dimensions(small_world):
    g = small_world["grid"]
    assert len(small_world["cells"]) == g["latBands"] * g["lonBands"]


def test_biomes_are_valid(small_world):
    for cell in small_world["cells"]:
        assert cell["biome"] in B.ALL_BIOMES
        assert 0.0 <= cell["moisture"] <= 1.0
        assert -60.0 <= cell["temp"] <= 60.0
        assert 0.0 <= cell["height"] <= 1.0


def test_requested_entity_counts(small_world):
    assert len(small_world["civilizations"]) == SMALL_PARAMS["civilizations"]
    assert len(small_world["species"]) == SMALL_PARAMS["species"]
    assert len(small_world["plants"]) == SMALL_PARAMS["plants"]
    deposits = sum(len(c["deposits"]) for c in small_world["cells"])
    assert deposits == SMALL_PARAMS["deposits"]


def test_civilizations_start_on_habitable_land(small_world):
    for city in small_world["cities"].values():
        cell = small_world["cells"][city["cellId"]]
        assert B.is_habitable(cell["biome"])
        assert cell["owner"] == city["civId"]


def test_species_have_positive_populations(small_world):
    for sp in small_world["species"].values():
        assert sum(sp["populations"].values()) > 0
        for key in sp["populations"]:
            cell = small_world["cells"][int(key)]
            assert B.is_land(cell["biome"])


def test_food_web_links_exist(small_world):
    carnivores = [s for s in small_world["species"].values() if s["traits"]["diet"] == "carnivore"]
    assert carnivores, "expected some carnivores"
    for sp in carnivores:
        for prey_id in sp["prey"]:
            prey = small_world["species"][prey_id]
            assert prey["traits"]["size"] <= sp["traits"]["size"] * 0.9 + 1e-9


def test_genesis_event_first(small_world):
    assert small_world["events"][0]["type"] == WORLD_GENESIS
