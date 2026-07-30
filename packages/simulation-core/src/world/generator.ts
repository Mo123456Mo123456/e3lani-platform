import type { BiomeType } from "@planet/shared-types";
import { SeededRandom } from "../rng/seeded-random.js";
import { Noise2D } from "../noise/noise2d.js";

export interface PlanetCell {
  x: number;
  y: number;
  lat: number;
  lon: number;
  elevation: number;
  moisture: number;
  temperature: number;
  biome: BiomeType;
  fertility: number;
  isOcean: boolean;
  plateId: number;
}

export interface GeneratedRegion {
  id: string;
  name: string;
  nameAr: string;
  biome: BiomeType;
  lat: number;
  lon: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  plateId: number;
  gridX: number;
  gridY: number;
}

export interface GeneratedPlanet {
  seed: string;
  resolution: number;
  cells: PlanetCell[];
  regions: GeneratedRegion[];
  heightMap: Float32Array;
  moistureMap: Float32Array;
  temperatureMap: Float32Array;
  biomeMap: BiomeType[];
}

const BIOME_NAMES_AR: Record<BiomeType, string[]> = {
  ocean: ["محيط أزور", "بحر الشفق", "خليج الندى"],
  coast: ["ساحل الرياح", "شاطئ المرجان", "رأس الضباب"],
  plains: ["سهول الفجر", "مرج الذهب", "وادي الصمت"],
  rainforest: ["غابة الضباب", "أدغال الزمرد", "غابة الأنهار"],
  temperate_forest: ["غابة البلوط", "أحراج الشمال", "غابة الندى"],
  desert: ["صحراء الرمال", "براري القفر", "كثبان اللهب"],
  mountain: ["جبال الشاهق", "قمم الجليد", "سلسلة الصخر"],
  tundra: ["تندرا الشمال", "سهول الصقيع", "أراضي الثلج"],
  swamp: ["مستنقع الضفادع", "سبخة الضباب", "أهوار الجنوب"],
  steppe: ["سهوب الرياح", "مراعي الأفق", "براري العشب"],
  volcanic: ["هضبة البركان", "أرض الحمم", "فوهة النار"],
  ice: ["غطاء جليدي", "قطب الأبد", "جليد أزرق"],
};

const BIOME_NAMES_EN: Record<BiomeType, string[]> = {
  ocean: ["Azure Ocean", "Twilight Sea", "Dew Gulf"],
  coast: ["Wind Coast", "Coral Shore", "Mist Cape"],
  plains: ["Dawn Plains", "Golden Mead", "Silent Vale"],
  rainforest: ["Mist Jungle", "Emerald Deep", "River Canopy"],
  temperate_forest: ["Oakwood", "Northern Groves", "Dew Forest"],
  desert: ["Sand Wastes", "Barren Reach", "Flame Dunes"],
  mountain: ["High Peaks", "Ice Crests", "Stone Range"],
  tundra: ["North Tundra", "Frost Plains", "Snow Lands"],
  swamp: ["Frog Marsh", "Mist Fen", "South Wetlands"],
  steppe: ["Wind Steppe", "Horizon Pastures", "Grass Reach"],
  volcanic: ["Volcano Plateau", "Lava Lands", "Fire Caldera"],
  ice: ["Ice Sheet", "Eternal Pole", "Blue Glacier"],
};

export function classifyBiome(
  elevation: number,
  moisture: number,
  temperature: number,
  lat: number,
): BiomeType {
  if (elevation < 0.28) return "ocean";
  if (elevation < 0.32) return "coast";
  if (elevation > 0.82) return temperature < 0.35 ? "ice" : "mountain";
  if (temperature < 0.22) return elevation > 0.6 ? "ice" : "tundra";
  if (moisture < 0.22 && temperature > 0.55) return "desert";
  if (moisture > 0.72 && temperature > 0.65) return "rainforest";
  if (moisture > 0.55 && temperature > 0.35 && temperature < 0.7)
    return "temperate_forest";
  if (moisture > 0.65 && elevation < 0.4) return "swamp";
  if (moisture < 0.4 && temperature > 0.35 && temperature < 0.65) return "steppe";
  if (elevation > 0.7 && moisture < 0.35) return "volcanic";
  if (Math.abs(lat) > 0.75 && temperature < 0.3) return "ice";
  return "plains";
}

export function generatePlanet(
  seed: string,
  resolution = 64,
): GeneratedPlanet {
  const rng = new SeededRandom(seed);
  const heightNoise = new Noise2D(rng.fork("height"));
  const moistNoise = new Noise2D(rng.fork("moisture"));
  const tempNoise = new Noise2D(rng.fork("temp"));
  const plateNoise = new Noise2D(rng.fork("plates"));

  const n = resolution;
  const cells: PlanetCell[] = [];
  const heightMap = new Float32Array(n * n);
  const moistureMap = new Float32Array(n * n);
  const temperatureMap = new Float32Array(n * n);
  const biomeMap: BiomeType[] = new Array(n * n);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / (n - 1);
      const v = y / (n - 1);
      // Equirectangular: lat [-1,1], lon [-1,1]
      const lat = 1 - 2 * v;
      const lon = 2 * u - 1;

      // Continent mask via fbm — tuned so both oceans and land always appear
      const continent =
        0.42 +
        0.38 * heightNoise.fbm(u * 2.4, v * 2.4, 5) +
        0.12 * heightNoise.fbm(u * 6.5, v * 6.5, 3);
      // Polar oceans slightly deeper; equatorial boost for land bridges
      let elevation = continent - 0.12 * Math.abs(lat) + 0.04 * (1 - Math.abs(lat));
      // Ridges via worley inversion
      const ridge = 1 - heightNoise.worley(u, v, 3.5);
      elevation = Math.max(0, Math.min(1, elevation * 0.82 + ridge * 0.18));

      let moisture =
        0.5 +
        0.4 * moistNoise.fbm(u * 2.5 + 10, v * 2.5, 4) -
        0.15 * Math.max(0, elevation - 0.5);
      // Rain shadow approximation: west of mountains drier
      moisture = Math.max(0, Math.min(1, moisture));

      // Temperature: equator hot, poles cold, elevation cools
      let temperature =
        0.55 +
        0.35 * (1 - Math.abs(lat)) +
        0.1 * tempNoise.fbm(u * 2, v * 2, 3) -
        0.35 * Math.max(0, elevation - 0.45);
      temperature = Math.max(0, Math.min(1, temperature));

      const plateId = Math.floor(
        ((plateNoise.noise(u * 2, v * 2) + 1) / 2) * 8,
      );
      const biome = classifyBiome(elevation, moisture, temperature, lat);
      const fertility =
        biome === "ocean" || biome === "ice" || biome === "desert"
          ? 0.05
          : Math.max(
              0,
              Math.min(
                1,
                moisture * 0.55 +
                  (1 - Math.abs(temperature - 0.55)) * 0.35 +
                  (elevation > 0.3 && elevation < 0.65 ? 0.15 : 0),
              ),
            );

      const idx = y * n + x;
      heightMap[idx] = elevation;
      moistureMap[idx] = moisture;
      temperatureMap[idx] = temperature;
      biomeMap[idx] = biome;

      cells.push({
        x,
        y,
        lat,
        lon,
        elevation,
        moisture,
        temperature,
        biome,
        fertility,
        isOcean: biome === "ocean",
        plateId,
      });
    }
  }

  // Approximate rivers: flow from high to low toward ocean
  approximateRivers(cells, n, heightMap);

  // Build Voronoi-ish regions by sampling land cells
  const regions = buildRegions(cells, n, rng, 96);

  return {
    seed,
    resolution: n,
    cells,
    regions,
    heightMap,
    moistureMap,
    temperatureMap,
    biomeMap,
  };
}

function approximateRivers(
  cells: PlanetCell[],
  n: number,
  heightMap: Float32Array,
): void {
  // Increase moisture along downhill paths from wet highlands
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (c.isOcean || c.elevation < 0.45 || c.moisture < 0.5) continue;
    let x = c.x;
    let y = c.y;
    for (let step = 0; step < 40; step++) {
      let bestX = x;
      let bestY = y;
      let bestH = heightMap[y * n + x]!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const h = heightMap[ny * n + nx]!;
        if (h < bestH) {
          bestH = h;
          bestX = nx;
          bestY = ny;
        }
      }
      if (bestX === x && bestY === y) break;
      x = bestX;
      y = bestY;
      const cell = cells[y * n + x]!;
      cell.moisture = Math.min(1, cell.moisture + 0.04);
      cell.fertility = Math.min(1, cell.fertility + 0.02);
      if (cell.isOcean) break;
    }
  }
}

function buildRegions(
  cells: PlanetCell[],
  n: number,
  rng: SeededRandom,
  count: number,
): GeneratedRegion[] {
  const land = cells.filter((c) => !c.isOcean);
  const step = Math.max(1, Math.floor(land.length / count));
  const regions: GeneratedRegion[] = [];
  const used = new Set<string>();

  for (let i = 0; i < land.length && regions.length < count; i += step) {
    const c = land[i]!;
    const key = `${Math.floor(c.x / 4)}:${Math.floor(c.y / 4)}`;
    if (used.has(key)) continue;
    used.add(key);
    const namesAr = BIOME_NAMES_AR[c.biome];
    const namesEn = BIOME_NAMES_EN[c.biome];
    const pick = rng.int(0, namesAr.length - 1);
    const id = `reg_${regions.length.toString().padStart(3, "0")}`;
    regions.push({
      id,
      name: `${namesEn[pick]} ${regions.length + 1}`,
      nameAr: `${namesAr[pick]} ${regions.length + 1}`,
      biome: c.biome,
      lat: c.lat,
      lon: c.lon,
      elevation: c.elevation,
      temperature: c.temperature,
      moisture: c.moisture,
      fertility: c.fertility,
      plateId: c.plateId,
      gridX: c.x,
      gridY: c.y,
    });
  }
  return regions;
}

/** Encode height map as a compact base64 float preview for clients */
export function heightMapPreview(
  heightMap: Float32Array,
  resolution: number,
): number[][] {
  const out: number[][] = [];
  const step = Math.max(1, Math.floor(resolution / 32));
  for (let y = 0; y < resolution; y += step) {
    const row: number[] = [];
    for (let x = 0; x < resolution; x += step) {
      row.push(Math.round(heightMap[y * resolution + x]! * 1000) / 1000);
    }
    out.push(row);
  }
  return out;
}
