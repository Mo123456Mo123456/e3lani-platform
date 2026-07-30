/** Biome constants + palette, mirrored from the engine for rendering. */

export const BIOME_PALETTE: Record<string, [number, number, number]> = {
  ocean: [18, 46, 92],
  coast: [42, 84, 140],
  plains: [126, 148, 74],
  grassland: [110, 156, 82],
  savanna: [176, 164, 92],
  rainforest: [22, 102, 52],
  temperate_forest: [46, 122, 62],
  boreal_forest: [38, 92, 74],
  desert: [206, 182, 122],
  steppe: [158, 152, 100],
  tundra: [146, 158, 150],
  ice: [232, 240, 246],
  mountain: [128, 118, 108],
  volcanic: [96, 58, 48],
  swamp: [76, 104, 76],
};

export const SEA_LEVEL = 0.42;

export function classifyBiome(
  height: number,
  tempC: number,
  moisture: number,
  nearOcean: boolean,
  volcanic: boolean,
): string {
  if (height < SEA_LEVEL) {
    return nearOcean && height > SEA_LEVEL - 0.06 ? "coast" : "ocean";
  }
  if (volcanic) return "volcanic";
  if (height > 0.86) return tempC < -8 ? "ice" : "mountain";
  if (tempC <= -14) return "ice";
  if (tempC <= -4) return "tundra";
  if (height <= SEA_LEVEL + 0.015 && nearOcean && moisture > 0.55 && tempC > 4 && tempC < 26) {
    return "swamp";
  }
  if (tempC < 2) return moisture < 0.35 ? "steppe" : "boreal_forest";
  if (tempC < 12) {
    if (moisture < 0.18) return "steppe";
    if (moisture < 0.42) return "grassland";
    return "temperate_forest";
  }
  if (tempC < 22) {
    if (moisture < 0.14) return "desert";
    if (moisture < 0.3) return "steppe";
    if (moisture < 0.55) return "grassland";
    return "temperate_forest";
  }
  if (moisture < 0.16) return "desert";
  if (moisture < 0.35) return "savanna";
  if (moisture < 0.6) return "grassland";
  return "rainforest";
}
