export type Biome =
  | "ocean"
  | "coast"
  | "plains"
  | "tropical_forest"
  | "temperate_forest"
  | "desert"
  | "mountain"
  | "tundra"
  | "wetland"
  | "steppe"
  | "volcanic"
  | "ice";

export interface GeneratedRegion {
  id: string;
  index: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  surfaceWater: number;
  wind: number;
  plateActivity: number;
  resourceRichness: number;
  carryingCapacity: number;
  biome: Biome;
}

export interface GeneratedPlanet {
  seed: string;
  rows: number;
  columns: number;
  regions: GeneratedRegion[];
  checksum: string;
}

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string | number): () => number {
  let state = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function randomLattice(x: number, y: number, z: number, seed: number): number {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
  value = Math.imul(value ^ (value >>> 13) ^ seed, 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function valueNoise3d(x: number, y: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const tz = smoothstep(z - z0);
  const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
  const sample = (dx: number, dy: number, dz: number) =>
    randomLattice(x0 + dx, y0 + dy, z0 + dz, seed);

  const x00 = lerp(sample(0, 0, 0), sample(1, 0, 0), tx);
  const x10 = lerp(sample(0, 1, 0), sample(1, 1, 0), tx);
  const x01 = lerp(sample(0, 0, 1), sample(1, 0, 1), tx);
  const x11 = lerp(sample(0, 1, 1), sample(1, 1, 1), tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

function fractalNoise(x: number, y: number, z: number, seed: number, octaves = 5): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise3d(x * frequency, y * frequency, z * frequency, seed + octave * 997) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / normalization;
}

function classifyBiome(
  elevation: number,
  temperature: number,
  moisture: number,
  plateActivity: number,
): Biome {
  if (elevation < 0.42) return "ocean";
  if (elevation < 0.455) return "coast";
  if (temperature < 0.12) return "ice";
  if (elevation > 0.79) return plateActivity > 0.72 ? "volcanic" : "mountain";
  if (temperature < 0.26) return "tundra";
  if (moisture < 0.2 && temperature > 0.48) return "desert";
  if (moisture < 0.36) return "steppe";
  if (moisture > 0.76 && elevation < 0.55) return "wetland";
  if (moisture > 0.66 && temperature > 0.62) return "tropical_forest";
  if (moisture > 0.52) return "temperate_forest";
  return "plains";
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function generatePlanet(seed: string, rows = 18, columns = 36): GeneratedPlanet {
  if (!seed.trim()) throw new Error("A non-empty planet seed is required");
  if (rows < 4 || columns < 8) throw new Error("Planet grid resolution is too small");

  const seedNumber = hashSeed(seed);
  const regions: GeneratedRegion[] = [];

  for (let row = 0; row < rows; row += 1) {
    const latitude = -90 + ((row + 0.5) / rows) * 180;
    const latitudeRadians = (latitude * Math.PI) / 180;
    for (let column = 0; column < columns; column += 1) {
      const longitude = -180 + ((column + 0.5) / columns) * 360;
      const longitudeRadians = (longitude * Math.PI) / 180;
      const x = Math.cos(latitudeRadians) * Math.cos(longitudeRadians);
      const y = Math.sin(latitudeRadians);
      const z = Math.cos(latitudeRadians) * Math.sin(longitudeRadians);
      const continental = fractalNoise(x * 1.7 + 4, y * 1.7 + 4, z * 1.7 + 4, seedNumber);
      const ridges = Math.abs(fractalNoise(x * 4 + 9, y * 4 + 9, z * 4 + 9, seedNumber + 101) - 0.5) * 2;
      const elevation = Math.min(1, Math.max(0, continental * 0.8 + (1 - ridges) * 0.2));
      const latitudeTemperature = 1 - Math.pow(Math.abs(latitude) / 90, 1.35);
      const altitudeCooling = Math.max(0, elevation - 0.5) * 0.75;
      const temperatureNoise = fractalNoise(x * 3 + 16, y * 3 + 16, z * 3 + 16, seedNumber + 211);
      const temperature = Math.min(1, Math.max(0, latitudeTemperature * 0.78 + temperatureNoise * 0.22 - altitudeCooling));
      const oceanProximity = elevation < 0.46 ? 1 : Math.max(0, 1 - (elevation - 0.46) * 2.4);
      const rainShadow = elevation > 0.72 && longitude > 0 ? 0.2 : 0;
      const moistureNoise = fractalNoise(x * 3.2 + 27, y * 3.2 + 27, z * 3.2 + 27, seedNumber + 307);
      const moisture = Math.min(1, Math.max(0, moistureNoise * 0.64 + oceanProximity * 0.36 - rainShadow));
      const plateActivity = fractalNoise(x * 7 + 31, y * 7 + 31, z * 7 + 31, seedNumber + 401, 3);
      const surfaceWater = elevation < 0.42 ? 1 : Math.max(0, moisture * (1 - elevation) * 1.35);
      const fertility = Math.max(0, Math.min(1, moisture * 0.55 + temperature * 0.3 + plateActivity * 0.15 - Math.max(0, elevation - 0.72)));
      const resourceRichness = Math.max(0, Math.min(1, plateActivity * 0.55 + (1 - fertility) * 0.2 + fractalNoise(x * 8, y * 8, z * 8, seedNumber + 503, 2) * 0.25));
      const biome = classifyBiome(elevation, temperature, moisture, plateActivity);
      const habitable = biome === "ocean" || biome === "ice" ? 0.08 : biome === "desert" || biome === "mountain" ? 0.4 : 1;
      const carryingCapacity = Math.round((fertility * 700_000 + surfaceWater * 300_000) * habitable);
      const index = row * columns + column;

      regions.push({
        id: `region-${index.toString().padStart(4, "0")}`,
        index,
        name: `Sector ${String.fromCharCode(65 + (row % 26))}-${column + 1}`,
        latitude: round(latitude),
        longitude: round(longitude),
        elevation: round(elevation),
        temperature: round(temperature),
        moisture: round(moisture),
        fertility: round(fertility),
        surfaceWater: round(surfaceWater),
        wind: round(Math.abs(Math.sin(latitudeRadians * 3)) * 0.7 + 0.15),
        plateActivity: round(plateActivity),
        resourceRichness: round(resourceRichness),
        carryingCapacity,
        biome,
      });
    }
  }

  const checksum = hashSeed(
    regions.map((region) => `${region.id}:${region.biome}:${region.elevation}:${region.moisture}`).join("|"),
  )
    .toString(16)
    .padStart(8, "0");
  return { seed, rows, columns, regions, checksum };
}
