from __future__ import annotations

import math

import numpy as np

from .models import Region
from .rng import SeededRNG, stable_id

BIOME_LABELS_AR = {
    "ocean": "محيط",
    "coast": "ساحل",
    "plains": "سهول",
    "rainforest": "غابة مطيرة",
    "temperate_forest": "غابة معتدلة",
    "desert": "صحراء",
    "mountain": "جبل",
    "tundra": "تندرا",
    "wetland": "أرض رطبة",
    "steppe": "سهوب",
    "volcanic": "بركاني",
    "ice": "جليد",
}

BIOMES = tuple(BIOME_LABELS_AR)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def _smoothstep(t: np.ndarray) -> np.ndarray:
    return t * t * (3.0 - 2.0 * t)


def _value_noise(height: int, width: int, rng: SeededRNG, scale: int) -> np.ndarray:
    gy = max(2, math.ceil(height / scale) + 2)
    gx = max(2, math.ceil(width / scale) + 2)
    grid = rng.matrix((gy, gx))
    y = np.arange(height) / scale
    x = np.arange(width) / scale
    y0 = np.floor(y).astype(int)
    x0 = np.floor(x).astype(int)
    yf = _smoothstep(y - y0)
    xf = _smoothstep(x - x0)
    out = np.zeros((height, width), dtype=float)
    for row in range(height):
        a = grid[y0[row], x0]
        b = grid[y0[row], x0 + 1]
        top = a * (1.0 - xf) + b * xf
        c = grid[y0[row] + 1, x0]
        d = grid[y0[row] + 1, x0 + 1]
        bottom = c * (1.0 - xf) + d * xf
        out[row] = top * (1.0 - yf[row]) + bottom * yf[row]
    return out


def fractal_noise(height: int, width: int, rng: SeededRNG) -> np.ndarray:
    layers = [
        (max(4, min(height, width) // 3), 0.52),
        (max(3, min(height, width) // 6), 0.28),
        (max(2, min(height, width) // 12), 0.14),
        (2, 0.06),
    ]
    acc = np.zeros((height, width), dtype=float)
    total = 0.0
    for idx, (scale, weight) in enumerate(layers):
        acc += _value_noise(height, width, rng.stream(f"octave-{idx}"), scale) * weight
        total += weight
    acc /= total
    return (acc - acc.min()) / max(1e-9, acc.max() - acc.min())


def classify_biome(height: float, moisture: float, temperature: float, volcanic: float) -> str:
    if height < 0.36:
        return "ocean"
    if height < 0.405:
        return "coast"
    if temperature < 0.12:
        return "ice"
    if temperature < 0.25:
        return "tundra"
    if height > 0.84 and volcanic > 0.72:
        return "volcanic"
    if height > 0.78:
        return "mountain"
    if moisture > 0.78 and height < 0.58:
        return "wetland"
    if temperature > 0.68 and moisture > 0.68:
        return "rainforest"
    if moisture < 0.24 and temperature > 0.40:
        return "desert"
    if moisture < 0.36:
        return "steppe"
    if moisture > 0.54 and 0.28 <= temperature <= 0.72:
        return "temperate_forest"
    return "plains"


def _neighbors(region_id: str, rows: int, cols: int) -> list[str]:
    _, ys, xs = region_id.split("-")
    y = int(ys)
    x = int(xs)
    result: list[str] = []
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ny = y + dy
        if 0 <= ny < rows:
            result.append(f"r-{ny}-{(x + dx) % cols}")
    return result


def _apply_rivers(
    height_map: np.ndarray, moisture: np.ndarray, river_rng: SeededRNG
) -> set[tuple[int, int]]:
    rows, cols = height_map.shape
    river_cells: set[tuple[int, int]] = set()
    candidates = [
        (float(height_map[y, x]), y, x)
        for y in range(rows)
        for x in range(cols)
        if height_map[y, x] > 0.62
    ]
    candidates.sort(reverse=True)
    river_count = min(max(4, rows * cols // 320), len(candidates))
    starts = candidates[: river_count * 3]
    for _, sy, sx in river_rng.shuffled(starts)[:river_count]:
        y, x = sy, sx
        visited: set[tuple[int, int]] = set()
        for _ in range(rows + cols):
            if (y, x) in visited:
                break
            visited.add((y, x))
            river_cells.add((y, x))
            moisture[y, x] = clamp(moisture[y, x] + 0.22)
            if height_map[y, x] < 0.405:
                break
            options: list[tuple[float, int, int]] = []
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny = y + dy
                nx = (x + dx) % cols
                if 0 <= ny < rows:
                    options.append((height_map[ny, nx], ny, nx))
            options.sort(key=lambda item: (item[0], abs(item[1] - rows // 2)))
            _, y, x = options[0]
    for y, x in list(river_cells):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny = y + dy
                nx = (x + dx) % cols
                if 0 <= ny < rows:
                    moisture[ny, nx] = clamp(moisture[ny, nx] + 0.08)
    return river_cells


def _resource_profile(biome: str, height: float, moisture: float, temp: float) -> dict[str, float]:
    resources: dict[str, float] = {}
    if biome in {"mountain", "volcanic"}:
        resources["ore"] = round(30 + 70 * height, 3)
        resources["stone"] = round(25 + 50 * height, 3)
    if biome == "volcanic":
        resources["geothermal"] = round(40 + 50 * height, 3)
    if biome in {"plains", "temperate_forest", "rainforest", "wetland", "steppe"}:
        resources["food"] = round(20 + 60 * moisture + 20 * temp, 3)
        resources["wood"] = round(15 + 75 * moisture, 3)
    if biome in {"desert", "steppe", "mountain"} and height > 0.48:
        resources["minerals"] = round(15 + 65 * height, 3)
    if biome in {"coast", "ocean", "wetland"}:
        resources["fish"] = round(20 + 70 * moisture, 3)
    if biome not in {"ocean", "ice"}:
        resources["freshwater"] = round(max(0.0, 100 * (moisture - 0.32)), 3)
    return resources


def generate_regions(seed: str, resolution: tuple[int, int]) -> dict[str, Region]:
    rows, cols = resolution
    rng = SeededRNG(seed, "world")
    continental = fractal_noise(rows, cols, rng.stream("height"))
    ridges = fractal_noise(rows, cols, rng.stream("ridges"))
    moisture = fractal_noise(rows, cols, rng.stream("moisture"))
    volcanic = fractal_noise(rows, cols, rng.stream("volcanic"))

    lat = np.linspace(-1.0, 1.0, rows)[:, None]
    equator_warmth = 1.0 - np.abs(lat)
    height_map = clamp_array(0.74 * continental + 0.26 * np.maximum(0.0, ridges - 0.42) * 1.55)
    height_map = clamp_array(height_map - 0.08 * np.abs(lat))
    temperature = clamp_array(0.78 * equator_warmth + 0.22 * fractal_noise(rows, cols, rng.stream("temp")) - 0.34 * height_map)
    moisture = clamp_array(0.82 * moisture + 0.18 * (1.0 - np.abs(lat)))
    river_cells = _apply_rivers(height_map, moisture, rng.stream("rivers"))

    regions: dict[str, Region] = {}
    for y in range(rows):
        for x in range(cols):
            biome = classify_biome(
                float(height_map[y, x]),
                float(moisture[y, x]),
                float(temperature[y, x]),
                float(volcanic[y, x]),
            )
            if (y, x) in river_cells and biome in {"plains", "steppe", "temperate_forest"}:
                biome = "wetland" if moisture[y, x] > 0.76 else biome
            fertility = fertility_for(biome, float(moisture[y, x]), float(temperature[y, x]))
            region_id = f"r-{y}-{x}"
            resources = _resource_profile(
                biome,
                float(height_map[y, x]),
                float(moisture[y, x]),
                float(temperature[y, x]),
            )
            if (y, x) in river_cells:
                resources["freshwater"] = round(resources.get("freshwater", 0.0) + 45.0, 3)
            regions[region_id] = Region(
                id=region_id,
                x=x,
                y=y,
                height=round(float(height_map[y, x]), 6),
                moisture=round(float(moisture[y, x]), 6),
                temperature=round(float(temperature[y, x]), 6),
                biome=biome,
                fertility=round(fertility, 6),
                pollution=round(0.015 * resources.get("ore", 0.0) / 100.0, 6),
                neighbors=_neighbors(region_id, rows, cols),
                resources=resources,
                labels={"en": biome.replace("_", " ").title(), "ar": BIOME_LABELS_AR[biome]},
            )
    return regions


def clamp_array(values: np.ndarray) -> np.ndarray:
    return np.clip(values, 0.0, 1.0)


def fertility_for(biome: str, moisture: float, temp: float) -> float:
    if biome in {"ocean", "ice", "mountain", "volcanic"}:
        base = {"ocean": 0.08, "ice": 0.04, "mountain": 0.16, "volcanic": 0.24}[biome]
    elif biome == "desert":
        base = 0.12
    elif biome == "wetland":
        base = 0.82
    elif biome == "rainforest":
        base = 0.9
    elif biome == "temperate_forest":
        base = 0.72
    elif biome == "plains":
        base = 0.62
    elif biome == "steppe":
        base = 0.42
    else:
        base = 0.45
    climate_fit = 1.0 - abs(temp - 0.56) * 0.55
    return clamp(base * (0.55 + moisture * 0.65) * climate_fit)


def summarize_resources(regions: dict[str, Region]) -> dict[str, dict[str, float]]:
    totals: dict[str, float] = {}
    by_region: dict[str, dict[str, float]] = {}
    for region in regions.values():
        for name, amount in region.resources.items():
            totals[name] = totals.get(name, 0.0) + amount
        if region.resources:
            by_region[region.id] = dict(region.resources)
    by_region["_totals"] = {k: round(v, 3) for k, v in sorted(totals.items())}
    return by_region


def planet_id_for(seed: str, resolution: tuple[int, int]) -> str:
    return stable_id("planet", seed, resolution[0], resolution[1], length=14)

