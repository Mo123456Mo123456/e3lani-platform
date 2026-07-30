"""Biome model: classification, palette and suitability rules.

Classification inputs: mean temperature (°C), moisture (0..1), height
(0..1, sea level = SEA_LEVEL), freshwater flags and volcanic activity.
"""
from __future__ import annotations

SEA_LEVEL = 0.42
COAST_BAND = 0.015

OCEAN = "ocean"
COAST = "coast"
PLAINS = "plains"
GRASSLAND = "grassland"
SAVANNA = "savanna"
RAINFOREST = "rainforest"
TEMPERATE_FOREST = "temperate_forest"
BOREAL_FOREST = "boreal_forest"
DESERT = "desert"
STEPPE = "steppe"
TUNDRA = "tundra"
ICE = "ice"
MOUNTAIN = "mountain"
VOLCANIC = "volcanic"
SWAMP = "swamp"

LAND_BIOMES = (
    PLAINS, GRASSLAND, SAVANNA, RAINFOREST, TEMPERATE_FOREST, BOREAL_FOREST,
    DESERT, STEPPE, TUNDRA, MOUNTAIN, VOLCANIC, SWAMP,
)
WATER_BIOMES = (OCEAN, COAST)
ALL_BIOMES = LAND_BIOMES + WATER_BIOMES + (ICE,)

# Walkability cost multiplier for trade/migration pathfinding (lower = easier).
TERRAIN_COST = {
    OCEAN: float("inf"), COAST: float("inf"), ICE: 6.0, MOUNTAIN: 5.0,
    VOLCANIC: 5.0, DESERT: 2.5, TUNDRA: 2.2, STEPPE: 1.6, SWAMP: 2.4,
    BOREAL_FOREST: 1.7, TEMPERATE_FOREST: 1.5, RAINFOREST: 2.2,
    SAVANNA: 1.3, GRASSLAND: 1.1, PLAINS: 1.0,
}

# Relative biomass capacity per biome (0..1 scale).
VEGETATION_CAPACITY = {
    OCEAN: 0.0, COAST: 0.0, ICE: 0.02, TUNDRA: 0.15, DESERT: 0.06,
    STEPPE: 0.3, MOUNTAIN: 0.2, VOLCANIC: 0.1, SAVANNA: 0.45,
    GRASSLAND: 0.55, PLAINS: 0.5, BOREAL_FOREST: 0.5,
    TEMPERATE_FOREST: 0.7, RAINFOREST: 0.95, SWAMP: 0.65,
}

# Base population carrying capacity for civilizations (per cell).
CIV_CAPACITY = {
    OCEAN: 0, COAST: 0, ICE: 300, TUNDRA: 1200, DESERT: 1500, STEPPE: 4000,
    MOUNTAIN: 1800, VOLCANIC: 500, SAVANNA: 6000, GRASSLAND: 12000,
    PLAINS: 15000, BOREAL_FOREST: 5000, TEMPERATE_FOREST: 9000,
    RAINFOREST: 5500, SWAMP: 2200,
}

BIOME_PALETTE = {
    OCEAN: (18, 46, 92),
    COAST: (42, 84, 140),
    PLAINS: (126, 148, 74),
    GRASSLAND: (110, 156, 82),
    SAVANNA: (176, 164, 92),
    RAINFOREST: (22, 102, 52),
    TEMPERATE_FOREST: (46, 122, 62),
    BOREAL_FOREST: (38, 92, 74),
    DESERT: (206, 182, 122),
    STEPPE: (158, 152, 100),
    TUNDRA: (146, 158, 150),
    ICE: (232, 240, 246),
    MOUNTAIN: (128, 118, 108),
    VOLCANIC: (96, 58, 48),
    SWAMP: (76, 104, 76),
}


def classify(height: float, temp_c: float, moisture: float, near_ocean: bool, volcanic: bool) -> str:
    if height < SEA_LEVEL:
        return COAST if (near_ocean and height > SEA_LEVEL - 0.06) else OCEAN
    if volcanic:
        return VOLCANIC
    if height > 0.86:
        return ICE if temp_c < -8 else MOUNTAIN
    if temp_c <= -14:
        return ICE
    if temp_c <= -4:
        return TUNDRA
    if height <= SEA_LEVEL + COAST_BAND and near_ocean and moisture > 0.55 and 4 < temp_c < 26:
        return SWAMP
    if temp_c < 2:
        return STEPPE if moisture < 0.35 else BOREAL_FOREST
    if temp_c < 12:
        if moisture < 0.18:
            return STEPPE
        if moisture < 0.42:
            return GRASSLAND
        return TEMPERATE_FOREST
    if temp_c < 22:
        if moisture < 0.14:
            return DESERT
        if moisture < 0.3:
            return STEPPE
        if moisture < 0.55:
            return GRASSLAND
        return TEMPERATE_FOREST
    # hot
    if moisture < 0.16:
        return DESERT
    if moisture < 0.35:
        return SAVANNA
    if moisture < 0.6:
        return GRASSLAND
    return RAINFOREST


def is_land(biome: str) -> bool:
    return biome not in WATER_BIOMES


def is_habitable(biome: str) -> bool:
    return biome in LAND_BIOMES and biome not in (VOLCANIC,)
