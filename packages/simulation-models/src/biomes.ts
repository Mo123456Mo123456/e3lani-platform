import type { Biome } from "@planet/config";

export function classifyBiome(
  elevation: number,
  temperature: number,
  moisture: number,
  lat: number,
): Biome {
  if (elevation < 0.28) return "ocean";
  if (elevation < 0.34) return "coast";
  if (elevation > 0.82) return temperature < 0.35 ? "ice" : "mountain";
  if (temperature < 0.22) return moisture > 0.45 ? "tundra" : "ice";
  if (elevation > 0.72 && temperature > 0.7 && moisture < 0.35) return "volcanic";
  if (moisture < 0.28) return temperature > 0.55 ? "desert" : "steppe";
  if (moisture > 0.72 && temperature > 0.6) return "rainforest";
  if (moisture > 0.55 && temperature > 0.35) return "temperate_forest";
  if (moisture > 0.65 && elevation < 0.45) return "wetland";
  if (Math.abs(lat) < 25 && moisture < 0.4) return "steppe";
  return "plains";
}

export const BIOME_LABELS: Record<Biome, { ar: string; en: string }> = {
  ocean: { ar: "محيط", en: "Ocean" },
  coast: { ar: "ساحل", en: "Coast" },
  plains: { ar: "سهول", en: "Plains" },
  rainforest: { ar: "غابة مطيرة", en: "Rainforest" },
  temperate_forest: { ar: "غابة معتدلة", en: "Temperate Forest" },
  desert: { ar: "صحراء", en: "Desert" },
  mountain: { ar: "جبال", en: "Mountains" },
  tundra: { ar: "تندرا", en: "Tundra" },
  wetland: { ar: "مستنقعات", en: "Wetland" },
  steppe: { ar: "سهوب", en: "Steppe" },
  volcanic: { ar: "بركاني", en: "Volcanic" },
  ice: { ar: "جليدي", en: "Ice" },
};
