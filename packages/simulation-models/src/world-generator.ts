import type {
  Biome,
  Civilization,
  PlanetRegion,
  WorldEvent,
  WorldState,
} from "@planet/shared-types";
import {
  clamp,
  fractalNoise3D,
  hashSeed,
  round,
  SeededRandom,
} from "./prng.js";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const CIVILIZATION_NAMES = [
  ["اتحاد السهول", "Plains Union"],
  ["ممالك الزمرد", "Emerald Kingdoms"],
  ["مجلس الشفق", "Aurora Council"],
  ["جمهورية الأنهار", "River Republic"],
  ["عشائر الجبال", "Mountain Clans"],
  ["رابطة السواحل", "Coastal League"],
  ["حماة السهوب", "Steppe Wardens"],
  ["مدن الرمال", "Cities of Sand"],
  ["اتحاد الغابات", "Forest Concord"],
  ["دولة البحيرات", "Lake State"],
  ["إمارات البرق", "Lightning Emirates"],
  ["حلف الجنوب", "Southern Pact"],
] as const;

function classifyBiome(input: {
  elevation: number;
  temperature: number;
  moisture: number;
  volcanic: number;
}): Biome {
  const { elevation, temperature, moisture, volcanic } = input;
  if (elevation < 0.44) return "ocean";
  if (elevation < 0.47) return "coast";
  if (temperature < 0.12) return "ice";
  if (temperature < 0.25) return "tundra";
  if (elevation > 0.79) return volcanic > 0.72 ? "volcanic" : "mountains";
  if (moisture > 0.78 && temperature > 0.58) return "rainforest";
  if (moisture > 0.66 && temperature > 0.3) return "temperate_forest";
  if (moisture > 0.8) return "wetlands";
  if (moisture < 0.2 && temperature > 0.45) return "desert";
  if (moisture < 0.38) return "steppe";
  return "plains";
}

function fnvChecksum(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stateChecksum(
  state: Omit<WorldState, "checksum"> | WorldState,
): string {
  return fnvChecksum(
    JSON.stringify({
      seed: state.planet.seed,
      tick: state.planet.tick,
      year: state.planet.year,
      regions: state.regions.map((region) => [
        region.id,
        region.biome,
        region.temperature,
        region.moisture,
        region.vegetation,
        region.pollution,
        region.population,
      ]),
      civilizations: state.civilizations.map((civilization) => [
        civilization.id,
        civilization.regionId,
        civilization.population,
        civilization.technology,
        civilization.stability,
      ]),
      contributions: state.contributions.map((contribution) => contribution.id),
      events: state.latestEvents.map((event) => event.id),
    }),
  );
}

export function createEvent(
  seed: string,
  sequence: number,
  event: Omit<WorldEvent, "id" | "sequence" | "createdAt" | "planetId">,
): WorldEvent {
  return {
    ...event,
    id: `evt_${fnvChecksum(`${seed}:${sequence}:${event.type}:${event.regionId ?? "global"}`)}`,
    planetId: `planet_${fnvChecksum(seed)}`,
    sequence,
    createdAt: new Date(Date.UTC(2026, 0, 1) + sequence * 1000).toISOString(),
  };
}

export function generateRegions(seed: string, count = 768): PlanetRegion[] {
  const numericSeed = hashSeed(seed);
  const regions: PlanetRegion[] = [];

  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const latitude = Math.asin(y) * (180 / Math.PI);
    const longitude = Math.atan2(z, x) * (180 / Math.PI);

    const continent = fractalNoise3D(
      numericSeed,
      x * 1.35 + 7,
      y * 1.35,
      z * 1.35,
      6,
    );
    const ridges =
      Math.abs(
        fractalNoise3D(numericSeed + 911, x * 4, y * 4, z * 4, 4) - 0.5,
      ) * 2;
    const elevation = clamp(continent * 0.86 + ridges * 0.2 - 0.08);
    const latitudeHeat = Math.cos(Math.abs(latitude) * (Math.PI / 180));
    const altitudeCooling = Math.max(0, elevation - 0.48) * 0.75;
    const temperature = clamp(latitudeHeat * 0.92 - altitudeCooling + 0.04);
    const oceanInfluence =
      elevation < 0.47 ? 0.28 : Math.max(0, 0.14 - (elevation - 0.47) * 0.3);
    const weatherNoise = fractalNoise3D(
      numericSeed + 2017,
      x * 2.2,
      y * 2.2,
      z * 2.2,
      5,
    );
    const rainShadow =
      Math.max(0, elevation - 0.67) *
      Math.max(0, Math.sin(longitude * (Math.PI / 180)));
    const moisture = clamp(
      weatherNoise * 0.78 + oceanInfluence - rainShadow * 0.45,
    );
    const volcanic = fractalNoise3D(numericSeed + 4049, x * 7, y * 7, z * 7, 3);
    const biome = classifyBiome({ elevation, temperature, moisture, volcanic });
    const isWater = biome === "ocean";
    const water = isWater
      ? 1
      : clamp(
          moisture * 0.68 +
            (biome === "wetlands" || biome === "coast" ? 0.24 : 0),
        );
    const fertility = isWater
      ? 0
      : clamp(
          moisture * 0.56 +
            temperature * 0.31 -
            Math.max(0, elevation - 0.7) * 1.5,
        );
    const vegetation =
      isWater || biome === "ice" || biome === "desert"
        ? clamp(fertility * 0.25)
        : clamp(fertility * 0.84 + moisture * 0.16);
    const resourceRichness = clamp(
      fractalNoise3D(numericSeed + 7919, x * 5, y * 5, z * 5, 4) * 0.75 +
        (biome === "mountains" || biome === "volcanic" ? 0.23 : 0),
    );
    const carryingCapacity = isWater
      ? 0
      : Math.round(
          (fertility * 2_500_000 + water * 1_200_000) * (0.5 + vegetation),
        );

    regions.push({
      id: `region_${index.toString().padStart(4, "0")}`,
      nameAr: `المنطقة ${index + 1}`,
      nameEn: `Region ${index + 1}`,
      latitude: round(latitude, 5),
      longitude: round(longitude, 5),
      elevation: round(elevation),
      temperature: round(temperature),
      moisture: round(moisture),
      precipitation: round(clamp(moisture * (0.45 + temperature * 0.55))),
      fertility: round(fertility),
      water: round(water),
      vegetation: round(vegetation),
      pollution: 0,
      population: 0,
      carryingCapacity,
      biome,
      resourceRichness: round(resourceRichness),
    });
  }

  return regions;
}

function foundCivilizations(
  seed: string,
  regions: PlanetRegion[],
): Civilization[] {
  const random = new SeededRandom(`${seed}:civilizations`);
  const candidates = regions
    .filter(
      (region) =>
        !["ocean", "ice", "tundra", "volcanic"].includes(region.biome) &&
        region.water > 0.38 &&
        region.fertility > 0.35,
    )
    .map((region) => ({
      region,
      score: region.fertility + region.water + random.next() * 0.3,
    }))
    .sort((a, b) => b.score - a.score);
  const selected: PlanetRegion[] = [];

  for (const candidate of candidates) {
    if (selected.length >= CIVILIZATION_NAMES.length) break;
    const separated = selected.every(
      (other) =>
        Math.abs(other.latitude - candidate.region.latitude) +
          Math.abs(other.longitude - candidate.region.longitude) >
        24,
    );
    if (separated) selected.push(candidate.region);
  }

  for (const candidate of candidates) {
    if (selected.length >= CIVILIZATION_NAMES.length) break;
    if (!selected.some((region) => region.id === candidate.region.id))
      selected.push(candidate.region);
  }

  return selected.map((region, index) => {
    const [nameAr, nameEn] = CIVILIZATION_NAMES[index]!;
    const population = random.int(
      180_000,
      Math.min(1_200_000, Math.max(200_000, region.carryingCapacity)),
    );
    region.population = population;
    region.civilizationId = `civ_${index + 1}`;
    return {
      id: `civ_${index + 1}`,
      nameAr,
      nameEn,
      regionId: region.id,
      population,
      technology: round(random.between(0.18, 0.52)),
      economy: round(random.between(0.22, 0.68)),
      military: round(random.between(0.12, 0.56)),
      stability: round(random.between(0.48, 0.86)),
      innovation: round(random.between(0.18, 0.7)),
      pollution: round(random.between(0.01, 0.08)),
      relations: {},
      memory: ["CIVILIZATION_FOUNDED"],
    };
  });
}

export function generateWorld(
  seed = "KA-2026-07",
  regionCount = 768,
): WorldState {
  const regions = generateRegions(seed, regionCount);
  const civilizations = foundCivilizations(seed, regions);
  const planetId = `planet_${fnvChecksum(seed)}`;
  const events: WorldEvent[] = [
    createEvent(seed, 1, {
      tick: 0,
      year: 1327,
      type: "WORLD_CREATED",
      cause: `deterministic_seed:${seed}`,
      actorIds: [],
      confidence: 1,
      directImpact: {},
      payload: { seed, algorithmVersion: "1.0.0", regionCount },
      titleAr: "استقرار العالم المحاكى",
      titleEn: "Simulated world stabilized",
      descriptionAr:
        "تولّد العالم إجرائيًا من بذرة ثابتة، وأصبحت كل طبقاته قابلة لإعادة الإنتاج.",
      descriptionEn:
        "The world was procedurally generated from a fixed seed; every layer is reproducible.",
    }),
    ...civilizations.map((civilization, index) =>
      createEvent(seed, index + 2, {
        tick: 0,
        year: 1327,
        type: "CIVILIZATION_FOUNDED",
        cause: "habitable_region_and_population_threshold",
        regionId: civilization.regionId,
        actorIds: [civilization.id],
        confidence: 0.96,
        directImpact: { population: civilization.population },
        payload: { civilizationId: civilization.id },
        titleAr: `نشأة ${civilization.nameAr}`,
        titleEn: `${civilization.nameEn} founded`,
        descriptionAr:
          "توفر الماء والتربة الخصبة سمحا باستقرار السكان ونشأة حضارة.",
        descriptionEn:
          "Water and fertile soil enabled settlement and the rise of a civilization.",
      }),
    ),
  ];

  const landRegions = regions.filter((region) => region.biome !== "ocean");
  const population = civilizations.reduce(
    (sum, civilization) => sum + civilization.population,
    0,
  );
  const state: Omit<WorldState, "checksum"> = {
    planet: {
      id: planetId,
      seed,
      nameAr: "أورِيا",
      nameEn: "Aurea",
      tick: 0,
      year: 1327,
      status: "paused",
      regionCount: regions.length,
      civilizationCount: civilizations.length,
      contributionCount: 0,
      eventCount: events.length,
      globalTemperature: round(
        regions.reduce((sum, region) => sum + region.temperature, 0) /
          regions.length,
      ),
      globalPollution: 0,
      biodiversity: Math.round(
        landRegions.reduce((sum, region) => sum + region.vegetation, 0) * 24,
      ),
      population,
    },
    regions,
    civilizations,
    contributions: [],
    latestEvents: events,
  };

  return { ...state, checksum: stateChecksum(state) };
}
