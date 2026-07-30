"""Scenarios output contract + PNG renderer sanity."""
import base64
import struct
import zlib

from app.maps import LAYERS, render_layers
from app.scenarios import run_scenarios


def test_scenario_report_shape(small_world):
    report = run_scenarios(small_world, contribution={
        "category": "plant", "name": "Probe Flora", "traits": {"growthRate": 0.5},
    }, horizons=[1, 10], runs=3)
    assert report["probabilistic"] is True
    assert len(report["horizons"]) == 2
    for horizon in report["horizons"]:
        for key in ("mostLikely", "best", "worst", "mean", "uncertainty", "drivers"):
            assert key in horizon
        assert 0.0 <= horizon["uncertainty"] <= 1.0
        assert horizon["best"]["habitability"] >= horizon["worst"]["habitability"]
        assert horizon["mostLikely"]["habitability"] >= horizon["worst"]["habitability"]


def test_scenario_without_contribution(small_world):
    report = run_scenarios(small_world, horizons=[1], runs=2)
    assert report["contributionId"] is None


def test_png_layers_decode(small_world):
    layers = render_layers(small_world, ["biome", "height"], scale=2)
    assert set(layers) == {"biome", "height"}
    for blob in layers.values():
        raw = base64.b64decode(blob)
        assert raw[:8] == b"\x89PNG\r\n\x1a\n"
        width, height = struct.unpack(">II", raw[16:24])
        assert width == small_world["grid"]["lonBands"] * 2
        assert height == small_world["grid"]["latBands"] * 2
        # IDAT must decompress to (width*4 + 1) * height bytes
        idat_len = struct.unpack(">I", raw[33:37])[0]
        idat = raw[41:41 + idat_len]
        data = zlib.decompress(idat)
        assert len(data) == (width * 4 + 1) * height


def test_all_layers_render(small_world):
    layers = render_layers(small_world, LAYERS, scale=1)
    assert set(layers) == set(LAYERS)
