import { BiomeType, ResourceKind } from "@planet/shared-types";

/**
 * The planet surface as an equirectangular grid. Typed arrays keep memory and
 * CPU under control; `serializeWorld` converts them to plain arrays for JSON.
 */
export interface PlanetGrid {
  width: number;
  height: number;
  cellCount: number;
  /** 0..1 — cells at or below `seaLevel` are ocean. */
  elevation: Float32Array;
  /** -1..1 normalized temperature (negative = freezing). */
  temperature: Float32Array;
  /** 0..1 */
  moisture: Float32Array;
  /** Index into BIOME_ORDER. */
  biome: Uint8Array;
  /** 0..1 soil + climate suitability for plant growth. */
  fertility: Float32Array;
  /** 0..1 accumulated pollution. */
  pollution: Float32Array;
  /** 1 where a river flows through the cell. */
  river: Uint8Array;
  /** 0..1 ice cover. */
  ice: Float32Array;
  /** 0..1 volcanic activity potential. */
  volcanic: Float32Array;
  /** Prevailing wind direction in radians (from latitude band). */
  windDir: Float32Array;
  seaLevel: number;
}

export interface ResourceDeposit {
  id: number;
  cell: number;
  kind: ResourceKind;
  quantity: number;
  /** Fraction replenished per tick (renewables). */
  regenRate: number;
  /** Fraction removable per tick by an extracting civ. */
  extractionRate: number;
  value: number;
  discoveredBy?: number;
  depleted: boolean;
}

export const BIOME_ORDER: BiomeType[] = [
  BiomeType.Ocean,
  BiomeType.Coast,
  BiomeType.Plains,
  BiomeType.Rainforest,
  BiomeType.TemperateForest,
  BiomeType.Desert,
  BiomeType.Mountains,
  BiomeType.Tundra,
  BiomeType.Swamp,
  BiomeType.Steppe,
  BiomeType.Volcanic,
  BiomeType.Ice,
];

export function biomeFromIndex(i: number): BiomeType {
  return BIOME_ORDER[i] ?? BiomeType.Ocean;
}

export function biomeIndex(b: BiomeType): number {
  return BIOME_ORDER.indexOf(b);
}
