import { BiomeType } from "@planet/shared-types";
import type { PlanetGrid } from "./types.js";

/**
 * Biome classification from latitude, elevation, temperature, moisture,
 * ocean proximity and volcanic activity. The same function is used at
 * generation time and re-applied by the climate system as conditions drift,
 * so deserts really do spread when rain fails.
 */
export function classifyCell(grid: PlanetGrid, index: number): BiomeType {
  const elevation = grid.elevation[index] ?? 0;
  const temp = grid.temperature[index] ?? 0;
  const moisture = grid.moisture[index] ?? 0;
  const volcanic = grid.volcanic[index] ?? 0;
  const sea = grid.seaLevel;

  if (elevation <= sea) {
    return BiomeType.Ocean;
  }
  if (volcanic > 0.75 && elevation > sea + 0.06) {
    return BiomeType.Volcanic;
  }
  const heightAboveSea = elevation - sea;
  if (heightAboveSea > 0.28) {
    return temp < -0.35 ? BiomeType.Ice : BiomeType.Mountains;
  }
  if (temp < -0.55) return BiomeType.Ice;
  if (temp < -0.25) return BiomeType.Tundra;
  if (heightAboveSea < 0.015) {
    if (moisture > 0.55) return BiomeType.Swamp;
    return BiomeType.Coast;
  }
  if (temp > 0.28) {
    if (moisture < 0.18) return BiomeType.Desert;
    if (moisture > 0.6) return BiomeType.Rainforest;
    if (moisture > 0.3) return BiomeType.TemperateForest;
    return BiomeType.Plains;
  }
  if (moisture < 0.15) return BiomeType.Desert;
  if (moisture < 0.32) return BiomeType.Steppe;
  if (moisture > 0.55) return BiomeType.TemperateForest;
  return BiomeType.Plains;
}

/** Base fertility table — rivers and volcanic ash modify this afterwards. */
export function baseFertility(biome: BiomeType): number {
  switch (biome) {
    case BiomeType.Rainforest: return 0.9;
    case BiomeType.TemperateForest: return 0.75;
    case BiomeType.Plains: return 0.7;
    case BiomeType.Swamp: return 0.6;
    case BiomeType.Steppe: return 0.5;
    case BiomeType.Coast: return 0.55;
    case BiomeType.Tundra: return 0.25;
    case BiomeType.Desert: return 0.12;
    case BiomeType.Mountains: return 0.2;
    case BiomeType.Volcanic: return 0.35;
    case BiomeType.Ice: return 0.02;
    case BiomeType.Ocean: return 0.4;
    default: return 0.3;
  }
}

/** How habitable a biome is for sedentary civilization. */
export function habitability(biome: BiomeType): number {
  switch (biome) {
    case BiomeType.Plains: return 0.95;
    case BiomeType.Coast: return 0.9;
    case BiomeType.TemperateForest: return 0.8;
    case BiomeType.Steppe: return 0.65;
    case BiomeType.Rainforest: return 0.55;
    case BiomeType.Swamp: return 0.4;
    case BiomeType.Desert: return 0.25;
    case BiomeType.Tundra: return 0.15;
    case BiomeType.Mountains: return 0.12;
    case BiomeType.Volcanic: return 0.08;
    case BiomeType.Ice: return 0.03;
    case BiomeType.Ocean: return 0;
    default: return 0.1;
  }
}
