from __future__ import annotations

import hashlib
import math
import random
from dataclasses import dataclass


BIOMES = {
    "ocean": "Ocean",
    "coast": "Coast",
    "plains": "Plains",
    "forest": "Forest",
    "desert": "Desert",
    "mountain": "Mountain",
    "tundra": "Tundra",
}


@dataclass(frozen=True)
class Cell:
    x: int
    y: int
    height: float
    moisture: float
    temperature: float
    biome: str


def _rng(seed: str, *parts: object) -> random.Random:
    digest = hashlib.sha256("|".join([seed, *(str(part) for part in parts)]).encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def _noise(seed: str, x: int, y: int, scale: int) -> float:
    base_x = x // scale
    base_y = y // scale
    local_x = (x % scale) / scale
    local_y = (y % scale) / scale

    def corner(dx: int, dy: int) -> float:
        return _rng(seed, base_x + dx, base_y + dy, scale).random()

    top = corner(0, 0) * (1 - local_x) + corner(1, 0) * local_x
    bottom = corner(0, 1) * (1 - local_x) + corner(1, 1) * local_x
    return top * (1 - local_y) + bottom * local_y


def _fractal(seed: str, x: int, y: int, rows: int, cols: int) -> float:
    scales = [max(2, min(rows, cols) // 3), max(2, min(rows, cols) // 6), 2]
    weights = [0.58, 0.29, 0.13]
    return sum(_noise(seed, x, y, scale) * weight for scale, weight in zip(scales, weights, strict=True))


def _biome(height: float, moisture: float, temperature: float) -> str:
    if height < 0.36:
        return "ocean"
    if height < 0.42:
        return "coast"
    if height > 0.78:
        return "mountain"
    if temperature < 0.2:
        return "tundra"
    if moisture < 0.25 and temperature > 0.45:
        return "desert"
    if moisture > 0.58:
        return "forest"
    return "plains"


def generate(seed: str, rows: int, cols: int) -> dict[str, object]:
    rows = max(2, min(rows, 96))
    cols = max(2, min(cols, 192))
    cells: list[Cell] = []

    for y in range(rows):
        latitude = abs((y / max(1, rows - 1)) * 2 - 1)
        for x in range(cols):
            height = max(0.0, min(1.0, _fractal(f"{seed}:height", x, y, rows, cols) - latitude * 0.08))
            moisture = max(0.0, min(1.0, _fractal(f"{seed}:moisture", x, y, rows, cols) + (1 - latitude) * 0.12))
            temperature = max(0.0, min(1.0, 1 - latitude * 0.9 - height * 0.22 + _fractal(f"{seed}:temp", x, y, rows, cols) * 0.24))
            biome = _biome(height, moisture, temperature)
            cells.append(
                Cell(
                    x=x,
                    y=y,
                    height=round(height, 4),
                    moisture=round(moisture, 4),
                    temperature=round(temperature, 4),
                    biome=biome,
                )
            )

    biome_counts: dict[str, int] = {}
    for cell in cells:
        biome_counts[cell.biome] = biome_counts.get(cell.biome, 0) + 1

    average_height = sum(cell.height for cell in cells) / len(cells)
    average_temperature = sum(cell.temperature for cell in cells) / len(cells)

    return {
        "seed": seed,
        "resolution": [rows, cols],
        "summary": {
            "averageHeight": round(average_height, 4),
            "averageTemperature": round(average_temperature, 4),
            "biomes": biome_counts,
            "surfaceRoughness": round(math.sqrt(sum((cell.height - average_height) ** 2 for cell in cells) / len(cells)), 4),
        },
        "cells": [
            {
                "id": f"r-{cell.y}-{cell.x}",
                "x": cell.x,
                "y": cell.y,
                "height": cell.height,
                "moisture": cell.moisture,
                "temperature": cell.temperature,
                "biome": cell.biome,
                "label": BIOMES[cell.biome],
            }
            for cell in cells
        ],
    }
