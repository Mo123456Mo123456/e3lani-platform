"""Map layer renderer: turns world state into PNG textures (base64).

Pure-Python minimal PNG encoder (no PIL dependency) — 8-bit RGB/RGBA,
one IDAT chunk. Output resolution = grid resolution × scale (nearest),
consumers smooth via GPU linear filtering.
"""
from __future__ import annotations

import base64
import struct
import zlib
from typing import Any

from . import biomes as B

LAYERS = ["height", "biome", "temperature", "moisture", "pollution", "political", "vegetation", "nightlights"]

_CIV_COLORS = [
    (212, 175, 55), (160, 120, 220), (76, 175, 130), (230, 126, 60),
    (90, 160, 230), (220, 90, 130), (150, 200, 80), (200, 160, 120),
    (120, 220, 200), (240, 200, 90), (180, 110, 90), (110, 130, 220),
    (220, 170, 220), (140, 200, 160),
]


def render_layers(state: dict[str, Any], layers: list[str] | None = None, scale: int = 4) -> dict[str, str]:
    layers = layers or LAYERS
    out: dict[str, str] = {}
    for layer in layers:
        fn = _RENDERERS.get(layer)
        if fn:
            out[layer] = base64.b64encode(fn(state, scale)).decode("ascii")
    return out


def _render(state: dict[str, Any], scale: int, pixel) -> bytes:
    w = state["grid"]["lonBands"]
    h = state["grid"]["latBands"]
    W, H = w * scale, h * scale
    cells = state["cells"]
    raw = bytearray()
    for y in range(H):
        raw.append(0)  # filter type 0
        lat_i = min(h - 1, y // scale)
        for x in range(W):
            lon_i = min(w - 1, x // scale)
            cid = lat_i * w + lon_i
            r, g, b, a = pixel(cells[cid], cid)
            raw += bytes((r, g, b, a))
    return _png(W, H, bytes(raw))


def _png(width: int, height: int, raw_scanlines: bytes) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw_scanlines, 6)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


# ---------------------------------------------------------------------
# Per-layer pixel functions
# ---------------------------------------------------------------------

def _gray(v: float) -> tuple[int, int, int, int]:
    c = max(0, min(255, int(v * 255)))
    return c, c, c, 255


def _layer_height(state, scale):
    return _render(state, scale, lambda cell, _: _gray(cell["height"]))


def _layer_biome(state, scale):
    def px(cell, _):
        rgb = B.BIOME_PALETTE.get(cell["biome"], (255, 0, 255))
        return rgb[0], rgb[1], rgb[2], 255
    return _render(state, scale, px)


def _lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _layer_temperature(state, scale):
    shift = state["meta"].get("globalTempShift", 0.0)
    def px(cell, _):
        t = (cell["temp"] + shift + 40.0) / 80.0  # -40..+40 -> 0..1
        rgb = _lerp((40, 70, 180), (220, 60, 40), t)
        return rgb[0], rgb[1], rgb[2], 255
    return _render(state, scale, px)


def _layer_moisture(state, scale):
    def px(cell, _):
        rgb = _lerp((190, 160, 110), (40, 90, 200), cell["moisture"])
        return rgb[0], rgb[1], rgb[2], 255
    return _render(state, scale, px)


def _layer_pollution(state, scale):
    def px(cell, _):
        base = B.BIOME_PALETTE.get(cell["biome"], (30, 30, 40))
        p = min(1.0, cell["pollution"] * 2.5)
        rgb = _lerp(base, (220, 50, 30), p)
        return rgb[0], rgb[1], rgb[2], 255
    return _render(state, scale, px)


def _civ_color(civ_id: str | None) -> tuple[int, int, int]:
    if civ_id is None:
        return (26, 32, 44)
    idx = 0
    for ch in civ_id:
        idx = (idx * 31 + ord(ch)) & 0xFFFF
    return _CIV_COLORS[idx % len(_CIV_COLORS)]


def _layer_political(state, scale):
    cells = state["cells"]
    w = state["grid"]["lonBands"]
    def px(cell, cid):
        color = _civ_color(cell["owner"]) if cell["owner"] else ((18, 46, 92) if cell["biome"] in B.WATER_BIOMES else (34, 40, 50))
        lon_i = cid % w
        right = cid + 1 if lon_i < w - 1 else cid - lon_i
        down = cid + w if cid + w < len(cells) else cid
        if cell["owner"] and (cells[right]["owner"] != cell["owner"] or cells[down]["owner"] != cell["owner"]):
            color = tuple(max(0, c - 70) for c in color)
        return color[0], color[1], color[2], 255
    return _render(state, scale, px)


def _layer_vegetation(state, scale):
    def px(cell, _):
        rgb = _lerp((40, 36, 30), (30, 180, 80), min(1.0, cell["vegetation"] * 1.6))
        return rgb[0], rgb[1], rgb[2], 255
    return _render(state, scale, px)


def _layer_nightlights(state, scale):
    city_cells: dict[int, int] = {}
    for city in state["cities"].values():
        city_cells[city["cellId"]] = city_cells.get(city["cellId"], 0) + city["population"]
    def px(cell, cid):
        pop = city_cells.get(cid, 0)
        glow = min(1.0, pop / 4000.0)
        base = 8 + int(cell["pollution"] * 20)
        r = min(255, base + int(255 * glow))
        g = min(255, base + int(210 * glow))
        b = min(255, base + int(120 * glow))
        return r, g, b, 255
    return _render(state, scale, px)


_RENDERERS = {
    "height": _layer_height,
    "biome": _layer_biome,
    "temperature": _layer_temperature,
    "moisture": _layer_moisture,
    "pollution": _layer_pollution,
    "political": _layer_political,
    "vegetation": _layer_vegetation,
    "nightlights": _layer_nightlights,
}
