/**
 * Biome classification from physical drivers: height, latitude, temperature,
 * moisture, volcanic activity. Pure function — the same cell inputs always
 * yield the same biome.
 */
import type { Biome } from "@planet/shared-types";

export interface BiomeInputs {
  height: number;
  latitude: number;
  temperature: number;
  moisture: number;
  volcanic: boolean;
  /** true for shallow sea adjacent to land */
  coastalWater: boolean;
  river: boolean;
}

export function classifyBiome(input: BiomeInputs): Biome {
  const { height, temperature, moisture } = input;

  if (height < 0) return input.coastalWater ? "coast" : "ocean";
  if (input.volcanic) return "volcanic";
  if (temperature < 0.1) return "ice";
  if (temperature < 0.22) return "tundra";
  if (height > 0.62) return "mountains";

  if (moisture > 0.78 && temperature > 0.55) return "rainforest";
  if (moisture > 0.58 && temperature > 0.32) return "temperate_forest";
  if (moisture > 0.72 && temperature > 0.3 && height < 0.2) return "swamp";
  if (moisture < 0.18 && temperature > 0.5) return "desert";
  if (moisture < 0.34) return "steppe";
  return "plains";
}

/** Base soil fertility by biome, before rivers and local modifiers. */
export const BIOME_FERTILITY: Record<Biome, number> = {
  ocean: 0,
  coast: 0.1,
  ice: 0.02,
  tundra: 0.15,
  mountains: 0.1,
  volcanic: 0.35,
  desert: 0.08,
  steppe: 0.45,
  plains: 0.65,
  temperate_forest: 0.7,
  rainforest: 0.6,
  swamp: 0.5,
};

/** Can a civilization settle this biome directly? */
export const BIOME_HABITABLE: Record<Biome, boolean> = {
  ocean: false,
  coast: false,
  ice: false,
  tundra: true,
  mountains: true,
  volcanic: false,
  desert: true,
  steppe: true,
  plains: true,
  temperate_forest: true,
  rainforest: true,
  swamp: true,
};

/** Movement cost multiplier for pathfinding (1 = easy). */
export const BIOME_MOVE_COST: Record<Biome, number> = {
  ocean: 8,
  coast: 3,
  ice: 6,
  tundra: 2.5,
  mountains: 4,
  volcanic: 5,
  desert: 2.5,
  steppe: 1.2,
  plains: 1,
  temperate_forest: 1.6,
  rainforest: 2.2,
  swamp: 2.8,
};
