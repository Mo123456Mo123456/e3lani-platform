import type { PlanetRegion, Resource } from "@kawkab/shared-types";
import { classifyBiome, PerlinNoise, SeededRandom, clamp01 } from "@kawkab/simulation-models";

export interface GeneratedPlanetGrid {
  seed: string;
  resolution: number;
  regions: PlanetRegion[];
  heightMap: number[][];
  moistureMap: number[][];
  temperatureMap: number[][];
}

function capacityFor(region: Pick<PlanetRegion, "biome" | "moisture" | "temperature" | "elevation">): number {
  const base: Record<string, number> = {
    deep_ocean: 0,
    shallow_ocean: 50,
    beach: 120,
    tundra: 80,
    taiga: 260,
    temperate_forest: 520,
    rainforest: 700,
    grassland: 460,
    savanna: 360,
    desert: 70,
    mountain: 90,
    volcanic: 45,
    ice_cap: 10,
    wetland: 580
  };
  return Math.round((base[region.biome] ?? 100) * (0.6 + region.moisture * 0.4) * (1 - Math.max(0, region.elevation - 0.75)));
}

function resourcesFor(seed: string, planetId: string, regionId: string, biome: string, abundanceNoise: number): Resource[] {
  const rng = new SeededRandom(`${seed}:${regionId}:resources`);
  const resources: Resource[] = [];
  if (["rainforest", "temperate_forest", "grassland", "savanna", "wetland"].includes(biome) && abundanceNoise > 0.34) {
    resources.push({ id: `${regionId}:food`, planetId, regionId, name: "غذاء بري / Wild food", category: "food", abundance: clamp01(abundanceNoise), renewability: 0.82 });
  }
  if (["mountain", "volcanic", "taiga"].includes(biome) && rng.next() > 0.35) {
    resources.push({ id: `${regionId}:ore`, planetId, regionId, name: "معادن نادرة / Rare ore", category: "mineral", abundance: clamp01(rng.range(0.35, 0.9)), renewability: 0.05 });
  }
  if (!["deep_ocean", "ice_cap", "desert"].includes(biome) && rng.next() > 0.45) {
    resources.push({ id: `${regionId}:water`, planetId, regionId, name: "مياه عذبة / Fresh water", category: "water", abundance: clamp01(rng.range(0.25, 0.95)), renewability: 0.9 });
  }
  if (biome === "volcanic") {
    resources.push({ id: `${regionId}:thermal`, planetId, regionId, name: "حرارة جوفية / Geothermal heat", category: "energy", abundance: 0.74, renewability: 0.5 });
  }
  return resources;
}

export function generatePlanet(seed: string, resolution = 32): GeneratedPlanetGrid {
  if (resolution < 4 || resolution > 256) throw new Error("resolution must be between 4 and 256");
  const planetId = `planet-${seed}`;
  const heightNoise = new PerlinNoise(`${seed}:height`);
  const moistureNoise = new PerlinNoise(`${seed}:moisture`);
  const tempNoise = new PerlinNoise(`${seed}:temperature`);
  const volcanicNoise = new PerlinNoise(`${seed}:volcanic`);
  const heightMap: number[][] = [];
  const moistureMap: number[][] = [];
  const temperatureMap: number[][] = [];
  const regions: PlanetRegion[] = [];

  for (let y = 0; y < resolution; y += 1) {
    heightMap[y] = [];
    moistureMap[y] = [];
    temperatureMap[y] = [];
    for (let x = 0; x < resolution; x += 1) {
      const nx = x / resolution;
      const ny = y / resolution;
      const latitude = Math.abs(ny - 0.5) * 2;
      const continental = heightNoise.octave2D(nx * 3.1, ny * 3.1, 5, 0.52);
      const ridges = Math.abs(heightNoise.octave2D(nx * 9.7 + 50, ny * 9.7 - 20, 3, 0.48) - 0.5) * 2;
      const elevation = clamp01(continental * 0.78 + ridges * 0.22 - 0.05);
      const moisture = clamp01(moistureNoise.octave2D(nx * 4.2 + 100, ny * 4.2, 4, 0.55) + (0.38 - elevation) * 0.18);
      const temperature = clamp01(1 - latitude * 0.85 - Math.max(0, elevation - 0.55) * 0.35 + tempNoise.octave2D(nx * 2.5, ny * 2.5 + 30, 3, 0.5) * 0.25);
      const volcanic = volcanicNoise.octave2D(nx * 12, ny * 12, 2, 0.5) > 0.73;
      const biome = classifyBiome(elevation, moisture, temperature, volcanic);
      const riverStrength = biome !== "deep_ocean" && biome !== "shallow_ocean" && elevation > 0.42 ? clamp01((moisture - 0.52) * 1.8 + (elevation - 0.45) * 0.4) : 0;
      const regionId = `${planetId}:r:${x}:${y}`;
      const resources = resourcesFor(seed, planetId, regionId, biome, moisture);
      const region: PlanetRegion = {
        id: regionId,
        planetId,
        x,
        y,
        elevation,
        moisture,
        temperature,
        pollution: 0,
        biome,
        resources,
        riverStrength,
        populationCapacity: capacityFor({ biome, moisture, temperature, elevation })
      };
      heightMap[y]![x] = elevation;
      moistureMap[y]![x] = moisture;
      temperatureMap[y]![x] = temperature;
      regions.push(region);
    }
  }

  return { seed, resolution, regions, heightMap, moistureMap, temperatureMap };
}
