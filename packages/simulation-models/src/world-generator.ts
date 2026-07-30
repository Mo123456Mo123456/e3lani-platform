import type {
  Biome,
  Civilization,
  Region,
  WorldEvent,
  WorldMetrics,
  WorldState,
} from "./types";

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed: number, ...parts: (number | string)[]) {
  let value = seed >>> 0;
  for (const part of parts) {
    value ^= typeof part === "number" ? Math.imul(Math.floor(part * 10_000), 0x45d9f3b) : hashString(part);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value ^= value >>> 16;
  }
  return (value >>> 0) / 4_294_967_296;
}

function smooth(value: number) {
  return value * value * (3 - 2 * value);
}

function latticeNoise(x: number, y: number, seed: number) {
  return seededUnit(seed, x, y);
}

export function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = latticeNoise(x0, y0, seed);
  const b = latticeNoise(x0 + 1, y0, seed);
  const c = latticeNoise(x0, y0 + 1, seed);
  const d = latticeNoise(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

export function fractalNoise(x: number, y: number, seed: number, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise(x * frequency, y * frequency, seed + octave * 1_013) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / normalization;
}

export function classifyBiome(
  elevation: number,
  moisture: number,
  temperature: number,
  volcanic: number,
): Biome {
  if (elevation < -0.08) return "ocean";
  if (elevation < 0.01) return "coast";
  if (temperature < 0.08) return "ice";
  if (elevation > 0.73) return temperature < 0.26 ? "ice" : "mountain";
  if (volcanic > 0.89 && elevation > 0.28) return "volcanic";
  if (temperature < 0.25) return "tundra";
  if (moisture < 0.17 && temperature > 0.47) return "desert";
  if (moisture < 0.3) return "steppe";
  if (moisture > 0.75 && elevation < 0.18) return "wetland";
  if (moisture > 0.68 && temperature > 0.62) return "rainforest";
  if (moisture > 0.52) return "temperate_forest";
  return "plains";
}

function coordinates(index: number, count: number) {
  const y = 1 - (2 * (index + 0.5)) / count;
  const latitude = (Math.asin(y) * 180) / Math.PI;
  const longitude = ((((index * GOLDEN_ANGLE) % TAU) * 180) / Math.PI + 540) % 360 - 180;
  return { latitude, longitude };
}

function generateRegion(seed: number, index: number, count: number): Region {
  const { latitude, longitude } = coordinates(index, count);
  const nx = (longitude + 180) / 72;
  const ny = (latitude + 90) / 72;
  const continent = fractalNoise(nx, ny, seed, 5);
  const ridges = 1 - Math.abs(fractalNoise(nx * 1.7, ny * 1.7, seed + 41, 4) * 2 - 1);
  const elevation = round(clamp((continent - 0.49) * 3 + Math.max(0, ridges - 0.78) * 0.55, -1, 1));
  const latitudeHeat = 1 - Math.abs(latitude) / 90;
  const oceanInfluence = elevation < 0 ? 0.08 : 0;
  const temperature = round(
    clamp(latitudeHeat * 0.92 - Math.max(0, elevation) * 0.38 + oceanInfluence),
  );
  const windMoisture = fractalNoise(nx + 19.2, ny - 7.8, seed + 313, 4);
  const rainShadow = Math.max(0, elevation - 0.45) * 0.38;
  const moisture = round(clamp(windMoisture * 1.14 + oceanInfluence - rainShadow - 0.1));
  const volcanic = fractalNoise(nx * 2.4, ny * 2.4, seed + 827, 3);
  const biome = classifyBiome(elevation, moisture, temperature, volcanic);
  const fertility =
    biome === "ocean" || biome === "ice"
      ? 0
      : round(
          clamp(
            moisture * 0.42 +
              temperature * 0.27 +
              (1 - Math.abs(elevation)) * 0.22 +
              (biome === "volcanic" ? 0.2 : 0),
          ),
        );
  const resourceScore = round(
    clamp(fractalNoise(nx - 4.5, ny + 12.7, seed + 2_021, 3) * 0.72 + Math.abs(elevation) * 0.28),
  );
  const carryingCapacity =
    biome === "ocean" || biome === "ice" || biome === "mountain"
      ? 0
      : Math.round(20_000 + fertility * 1_900_000 + resourceScore * 310_000);

  return {
    id: `region-${String(index + 1).padStart(3, "0")}`,
    nameAr: `الإقليم ${index + 1}`,
    nameEn: `Region ${index + 1}`,
    latitude: round(latitude, 3),
    longitude: round(longitude, 3),
    elevation,
    moisture,
    temperature,
    fertility,
    pollution: round(seededUnit(seed, "pollution", index) * 0.05),
    population: 0,
    carryingCapacity,
    biome,
    resourceScore,
    civilizationId: null,
  };
}

function angularDistance(a: Region, b: Region) {
  const latA = (a.latitude * Math.PI) / 180;
  const latB = (b.latitude * Math.PI) / 180;
  const lonDelta = ((a.longitude - b.longitude) * Math.PI) / 180;
  return Math.acos(
    clamp(
      Math.sin(latA) * Math.sin(latB) + Math.cos(latA) * Math.cos(latB) * Math.cos(lonDelta),
      -1,
      1,
    ),
  );
}

const civilizationNames = [
  ["أوران", "Oran"],
  ["نيراف", "Nirav"],
  ["سولارا", "Solara"],
  ["إيلمار", "Ilmar"],
  ["كافيرا", "Kavera"],
  ["تيرون", "Tyron"],
  ["أزورا", "Azura"],
  ["فالورا", "Valora"],
  ["ميراد", "Mirad"],
  ["إيثرا", "Ethra"],
  ["سيرين", "Serein"],
  ["درافا", "Drava"],
] as const;

function seedCivilizations(seed: number, regions: Region[]) {
  const candidates = regions
    .filter((region) => region.carryingCapacity > 280_000)
    .map((region) => ({
      region,
      score:
        region.fertility * 0.46 +
        region.resourceScore * 0.3 +
        region.temperature * 0.14 +
        seededUnit(seed, "capital", region.id) * 0.1,
    }))
    .sort((a, b) => b.score - a.score || a.region.id.localeCompare(b.region.id));
  const selected: Region[] = [];
  for (const candidate of candidates) {
    if (selected.every((capital) => angularDistance(capital, candidate.region) > 0.34)) {
      selected.push(candidate.region);
    }
    if (selected.length === civilizationNames.length) break;
  }
  for (const candidate of candidates) {
    if (selected.length >= civilizationNames.length) break;
    if (!selected.some((region) => region.id === candidate.region.id)) selected.push(candidate.region);
  }

  const civilizations: Civilization[] = selected.map((capital, index) => {
    const [nameAr, nameEn] = civilizationNames[index];
    const population = Math.round(capital.carryingCapacity * (0.19 + seededUnit(seed, "civ-pop", index) * 0.18));
    return {
      id: `civilization-${index + 1}`,
      nameAr,
      nameEn,
      capitalRegionId: capital.id,
      population,
      technology: round(0.18 + seededUnit(seed, "tech", index) * 0.34),
      economy: round(0.2 + seededUnit(seed, "economy", index) * 0.42),
      stability: round(0.45 + seededUnit(seed, "stability", index) * 0.45),
      military: round(0.13 + seededUnit(seed, "military", index) * 0.48),
      pollution: round(seededUnit(seed, "civ-pollution", index) * 0.13),
    };
  });

  for (const region of regions) {
    if (region.carryingCapacity === 0 || selected.length === 0) continue;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    selected.forEach((capital, index) => {
      const distance = angularDistance(region, capital);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    if (closestDistance < 0.68) {
      const civilization = civilizations[closestIndex];
      region.civilizationId = civilization.id;
      const capitalBoost = region.id === civilization.capitalRegionId ? 1 : 0.13;
      region.population = Math.round(
        region.carryingCapacity *
          capitalBoost *
          (0.12 + seededUnit(seed, "region-pop", region.id) * 0.15),
      );
      region.pollution = round(clamp(region.pollution + civilization.pollution * capitalBoost));
    }
  }

  return civilizations;
}

export function calculateMetrics(regions: Region[], civilizations: Civilization[]): WorldMetrics {
  const land = regions.filter((region) => region.biome !== "ocean");
  const livingBiomes = new Set(
    land
      .filter((region) => !["ice", "desert", "volcanic"].includes(region.biome))
      .map((region) => region.biome),
  );
  return {
    temperature: round(regions.reduce((sum, region) => sum + region.temperature, 0) / regions.length),
    pollution: round(land.reduce((sum, region) => sum + region.pollution, 0) / Math.max(1, land.length)),
    biodiversity: round(clamp(livingBiomes.size / 7 + land.reduce((sum, region) => sum + region.fertility, 0) / land.length / 3)),
    population: regions.reduce((sum, region) => sum + region.population, 0),
    civilizations: civilizations.length,
    resources: Math.round(regions.reduce((sum, region) => sum + region.resourceScore, 0) * 10_000),
  };
}

function initialEvents(regions: Region[], civilizations: Civilization[]): WorldEvent[] {
  const oldest = civilizations.slice(0, 4);
  const resourceRegions = [...regions]
    .filter((region) => region.biome !== "ocean")
    .sort((a, b) => b.resourceScore - a.resourceScore)
    .slice(0, 2);
  const events: WorldEvent[] = [
    {
      id: "event-world-created",
      kind: "WORLD_CREATED",
      tick: 0,
      year: 0,
      regionId: regions.find((region) => region.biome === "coast")?.id ?? regions[0].id,
      titleAr: "استقرار المحيطات الأولى",
      titleEn: "The first oceans stabilize",
      descriptionAr: "برد سطح الكوكب وتجمعت المياه في الأحواض المنخفضة وفق خرائط الارتفاع.",
      descriptionEn: "The surface cooled and water collected in low basins according to elevation.",
      importance: 5,
      confidence: 1,
      causeIds: ["planet-seed"],
      contributionId: null,
      directImpact: { oceanCoverage: 1 },
    },
    ...oldest.map<WorldEvent>((civilization, index) => ({
      id: `event-civilization-${index + 1}`,
      kind: "CIVILIZATION_FOUNDED",
      tick: index + 1,
      year: 120 + index * 86,
      regionId: civilization.capitalRegionId,
      titleAr: `نشأة حضارة ${civilization.nameAr}`,
      titleEn: `${civilization.nameEn} civilization founded`,
      descriptionAr: "وفرت خصوبة الإقليم والمياه والموارد قدرة استيعابية كافية للاستقرار.",
      descriptionEn: "Regional fertility, water, and resources created enough carrying capacity for settlement.",
      importance: 4,
      confidence: 0.94,
      causeIds: [civilization.capitalRegionId],
      contributionId: null,
      directImpact: { population: civilization.population },
    })),
    ...resourceRegions.map<WorldEvent>((region, index) => ({
      id: `event-resource-${index + 1}`,
      kind: "RESOURCE_DISCOVERED",
      tick: index + 3,
      year: 260 + index * 112,
      regionId: region.id,
      titleAr: "اكتشاف مكمن معدني",
      titleEn: "Mineral deposit discovered",
      descriptionAr: "كشف الاستكشاف الجيولوجي موردًا مرتفع الكثافة قرب حدود الصفائح.",
      descriptionEn: "Geological surveys found a dense resource near a plate boundary.",
      importance: 3,
      confidence: 0.91,
      causeIds: [region.id],
      contributionId: null,
      directImpact: { resources: region.resourceScore },
    })),
  ];
  return events.sort((a, b) => b.year - a.year);
}

export function generateWorld(seed = 2_047_319, regionCount = 192): WorldState {
  const safeCount = Math.max(48, Math.min(512, Math.floor(regionCount)));
  const regions = Array.from({ length: safeCount }, (_, index) =>
    generateRegion(seed, index, safeCount),
  );
  const civilizations = seedCivilizations(seed, regions);
  return {
    version: 1,
    seed,
    tick: 0,
    year: 2026,
    regions,
    civilizations,
    contributions: [],
    events: initialEvents(regions, civilizations),
    causalLinks: [],
    metrics: calculateMetrics(regions, civilizations),
  };
}
