import type { BiomeId, PlanetRegion, WorldEvent } from "@planet/shared-types";

import { fractalNoise3, ridgeNoise3, type Point3 } from "./noise";
import {
  clamp,
  deterministicUuid,
  SeededRandom,
} from "./random";
import type { SimulatedEntity, WorldState } from "./state";

const BIOME_COLORS: Record<BiomeId, string> = {
  ocean: "#0b4f7c",
  coast: "#2a8aa0",
  plains: "#6f9b45",
  rainforest: "#176b3a",
  temperate_forest: "#315f39",
  desert: "#bf914e",
  mountain: "#767b7d",
  tundra: "#9ba8a0",
  wetland: "#3f776b",
  steppe: "#9a9a55",
  volcanic: "#713b32",
  ice: "#d6eef3",
};

const ARABIC_REGIONS = [
  "وادي السديم",
  "سهول أورورا",
  "هضبة النور",
  "غابات إيلارا",
  "جزر الزمرد",
  "صحراء سيروس",
  "قمم أزور",
  "دلتا الحياة",
];

const ENGLISH_REGIONS = [
  "Nebula Vale",
  "Aurora Plains",
  "Lumen Plateau",
  "Elara Forest",
  "Emerald Isles",
  "Sirocco Reach",
  "Azure Peaks",
  "Vita Delta",
];

export interface GenerateWorldOptions {
  seed: string;
  regionCount?: number;
  startingYear?: number;
}

export function generateWorld({
  seed,
  regionCount = 512,
  startingYear = -12_000,
}: GenerateWorldOptions): WorldState {
  if (regionCount < 64 || regionCount > 8_192) {
    throw new Error("regionCount must be between 64 and 8192");
  }

  const worldId = deterministicUuid("world", seed);
  const regions = generateRegions(worldId, seed, regionCount);
  const random = new SeededRandom(`${seed}:entities`);
  const habitableRegions = regions.filter(
    ({ biome }) => biome !== "ocean" && biome !== "ice",
  );
  const entities: SimulatedEntity[] = [
    ...generateEntities("civilization", 12, habitableRegions, random, seed),
    ...generateEntities("city", 40, habitableRegions, random, seed),
    ...generateEntities("resource", 120, regions, random, seed),
    ...generateEntities("species", 300, regions, random, seed),
    ...generateEntities("plant", 800, habitableRegions, random, seed),
  ];

  const createdEvent: WorldEvent = {
    id: deterministicUuid(worldId, "event:0"),
    sequence: 0,
    worldId,
    type: "WORLD_CREATED",
    tick: 0,
    year: startingYear,
    regionId: null,
    cause: "procedural_generation_from_seed",
    causeEventIds: [],
    actorIds: [],
    contributionId: null,
    payload: {
      seed,
      regionCount,
      algorithmVersion: "worldgen-1",
    },
    confidence: 1,
    directImpact: {},
    createdAt: simulatedDate(0),
  };

  return {
    id: worldId,
    nameAr: "أرض نوفا",
    nameEn: "Nova Terra",
    seed,
    currentTick: 0,
    currentYear: startingYear,
    tickDuration: "year",
    running: false,
    regions,
    entities,
    contributions: [],
    events: [createdEvent],
    causalEdges: [],
    nextSequence: 1,
  };
}

function generateRegions(
  worldId: string,
  seed: string,
  count: number,
): PlanetRegion[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    const point = {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };
    const latitude = Math.asin(y) * (180 / Math.PI);
    const longitude = Math.atan2(point.z, point.x) * (180 / Math.PI);
    const continent = fractalNoise3(scale(point, 1.15), `${seed}:continent`, 4);
    const ridge = ridgeNoise3(scale(point, 3.4), `${seed}:ridge`);
    const elevation = clamp((continent - 0.53) * 2.4 + ridge * 0.24, -1, 1);
    const oceanInfluence = elevation < 0 ? 1 : clamp(1 - elevation * 3.2, 0, 1);
    const latitudeCooling = Math.pow(Math.abs(latitude) / 90, 1.35);
    const temperatureNoise =
      fractalNoise3(scale(point, 2.2), `${seed}:temperature`, 3) - 0.5;
    const temperature =
      31 -
      latitudeCooling * 48 -
      Math.max(elevation, 0) * 26 +
      temperatureNoise * 8;
    const moistureNoise = fractalNoise3(
      scale(point, 2.6),
      `${seed}:moisture`,
      4,
    );
    const rainShadow =
      elevation > 0.45 && longitude > 0 ? clamp(elevation * 0.28, 0, 0.22) : 0;
    const moisture = clamp(
      moistureNoise * 0.68 + oceanInfluence * 0.28 - rainShadow,
      0,
      1,
    );
    const volcanicNoise = ridgeNoise3(scale(point, 6.8), `${seed}:plates`);
    const biome = classifyBiome({
      elevation,
      temperature,
      moisture,
      volcanicNoise,
    });
    const fertility = clamp(
      moisture * 0.62 +
        (1 - Math.abs(temperature - 19) / 45) * 0.3 -
        Math.max(elevation, 0) * 0.25,
      0,
      1,
    );
    const resourceRichness = clamp(
      fractalNoise3(scale(point, 5.2), `${seed}:resources`, 3) * 0.7 +
        ridge * 0.3,
      0,
      1,
    );
    const population =
      biome === "ocean" || biome === "ice"
        ? 0
        : Math.round(fertility * moisture * 18_000);
    const nameIndex = Math.abs(
      Math.floor(longitude / 24 + latitude / 18 + index),
    );

    return {
      id: deterministicUuid(worldId, `region:${index}`),
      index,
      nameAr: `${ARABIC_REGIONS[nameIndex % ARABIC_REGIONS.length]} ${index + 1}`,
      nameEn: `${ENGLISH_REGIONS[nameIndex % ENGLISH_REGIONS.length]} ${index + 1}`,
      latitude: round(latitude, 4),
      longitude: round(longitude, 4),
      elevation: round(elevation, 5),
      temperature: round(temperature, 2),
      moisture: round(moisture, 5),
      fertility: round(fertility, 5),
      pollution: 0,
      population,
      biome,
      resourceRichness: round(resourceRichness, 5),
      color: BIOME_COLORS[biome],
    };
  });
}

function classifyBiome({
  elevation,
  temperature,
  moisture,
  volcanicNoise,
}: {
  elevation: number;
  temperature: number;
  moisture: number;
  volcanicNoise: number;
}): BiomeId {
  if (elevation < -0.04) return "ocean";
  if (elevation < 0.025) return "coast";
  if (temperature < -9) return "ice";
  if (elevation > 0.58) {
    return volcanicNoise > 0.91 ? "volcanic" : "mountain";
  }
  if (temperature < 3) return "tundra";
  if (moisture < 0.2 && temperature > 12) return "desert";
  if (moisture < 0.34) return "steppe";
  if (moisture > 0.78 && elevation < 0.2) return "wetland";
  if (moisture > 0.66 && temperature > 22) return "rainforest";
  if (moisture > 0.52) return "temperate_forest";
  return "plains";
}

function generateEntities(
  kind: SimulatedEntity["kind"],
  count: number,
  regions: PlanetRegion[],
  random: SeededRandom,
  seed: string,
): SimulatedEntity[] {
  return Array.from({ length: count }, (_, index) => {
    const region = random.pick(regions);
    const population =
      kind === "civilization"
        ? random.integer(16_000, 220_000)
        : kind === "city"
          ? random.integer(800, 38_000)
          : kind === "species" || kind === "plant"
            ? random.integer(2_000, 900_000)
            : 0;
    return {
      id: deterministicUuid(seed, `${kind}:${index}`),
      kind,
      name: `${kind}-${index + 1}`,
      regionId: region.id,
      population,
      health: random.between(0.55, 0.95),
      attributes: {
        adaptation: round(random.next(), 4),
        resilience: round(random.next(), 4),
        generated: true,
      },
    };
  });
}

function scale(point: Point3, factor: number): Point3 {
  return {
    x: point.x * factor,
    y: point.y * factor,
    z: point.z * factor,
  };
}

function round(value: number, precision: number): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

export function simulatedDate(sequence: number): string {
  return new Date(Date.UTC(2000, 0, 1, 0, 0, sequence)).toISOString();
}
