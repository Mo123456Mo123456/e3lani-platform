import type { BiomeType } from "@planet/shared-types";

export interface ClimateSample {
  elevation: number;
  temperature: number;
  moisture: number;
  latitude: number;
}

export function classifyBiome(c: ClimateSample): BiomeType {
  if (c.elevation < 0.28) return "ocean";
  if (c.elevation < 0.32) return "coast";
  if (c.elevation > 0.78) {
    if (c.temperature < 0.25) return "ice";
    return "mountain";
  }
  if (Math.abs(c.latitude) > 0.75 && c.temperature < 0.3) return "tundra";
  if (c.temperature > 0.7 && c.moisture < 0.25) return "desert";
  if (c.temperature > 0.65 && c.moisture > 0.7) return "rainforest";
  if (c.moisture > 0.75 && c.elevation < 0.45) return "swamp";
  if (c.temperature > 0.55 && c.moisture < 0.4) return "steppe";
  if (c.elevation > 0.65 && c.moisture < 0.35) return "volcanic";
  if (c.moisture > 0.45 && c.temperature > 0.3) return "temperate_forest";
  return "plains";
}

export const BIOME_LABELS: Record<BiomeType, { en: string; ar: string }> = {
  ocean: { en: "Ocean", ar: "محيط" },
  coast: { en: "Coast", ar: "ساحل" },
  plains: { en: "Plains", ar: "سهول" },
  rainforest: { en: "Rainforest", ar: "غابات مطيرة" },
  temperate_forest: { en: "Temperate Forest", ar: "غابات معتدلة" },
  desert: { en: "Desert", ar: "صحراء" },
  mountain: { en: "Mountains", ar: "جبال" },
  tundra: { en: "Tundra", ar: "تندرا" },
  swamp: { en: "Swamp", ar: "مستنقعات" },
  steppe: { en: "Steppe", ar: "سهوب" },
  volcanic: { en: "Volcanic", ar: "بركانية" },
  ice: { en: "Ice", ar: "جليد" },
};

export const BIOME_COLORS: Record<BiomeType, [number, number, number]> = {
  ocean: [0.05, 0.2, 0.45],
  coast: [0.75, 0.7, 0.45],
  plains: [0.45, 0.65, 0.25],
  rainforest: [0.05, 0.35, 0.1],
  temperate_forest: [0.15, 0.45, 0.2],
  desert: [0.85, 0.72, 0.4],
  mountain: [0.45, 0.42, 0.4],
  tundra: [0.7, 0.75, 0.72],
  swamp: [0.25, 0.35, 0.2],
  steppe: [0.65, 0.6, 0.3],
  volcanic: [0.35, 0.15, 0.1],
  ice: [0.9, 0.95, 1.0],
};

export function biomeSuitability(
  biome: BiomeType,
  preferred: BiomeType[],
): number {
  if (preferred.includes(biome)) return 1;
  if (biome === "ocean" || biome === "ice") return 0;
  return 0.25;
}
