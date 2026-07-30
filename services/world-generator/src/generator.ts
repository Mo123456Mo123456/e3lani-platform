function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type GeneratedPlanet = {
  seed: string;
  resolution: number;
  cells: Array<{ x: number; y: number; elevation: number; moisture: number; temperature: number; biome: string }>;
  source: string;
  regions?: unknown[];
};

function localGenerate(seed: string, resolution: number): GeneratedPlanet {
  const rng = mulberry32(hash(seed));
  const biomes = ['ocean', 'coast', 'plains', 'forest', 'desert', 'tundra', 'mountain'];
  const cells = [];
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const elevation = Number((rng() * 4000 - 800).toFixed(2));
      const moisture = Number(rng().toFixed(3));
      const temperature = Number((-25 + rng() * 60).toFixed(2));
      let biome = biomes[Math.floor(rng() * biomes.length)]!;
      if (elevation < 0) biome = 'ocean';
      else if (elevation > 3000) biome = 'mountain';
      cells.push({ x, y, elevation, moisture, temperature, biome });
    }
  }
  return { seed, resolution, cells, source: 'local-fallback' };
}

export async function generatePlanet(seed: string, resolution = 32): Promise<GeneratedPlanet> {
  try {
    const mod = (await import('@planet/simulation-models')) as {
      ProceduralPlanetGenerator?: new (
        seed: string,
        resolution?: number,
      ) => {
        generate: () => {
          seed: string;
          resolution: number;
          heightMap: Float32Array;
          moistureMap: Float32Array;
          temperatureMap: Float32Array;
          biomeMap: Uint8Array;
          regions: unknown[];
        };
      };
      idToBiome?: (id: number) => string;
    };

    if (mod.ProceduralPlanetGenerator) {
      const gen = new mod.ProceduralPlanetGenerator(seed, resolution);
      const result = gen.generate();
      const cells = [];
      for (let y = 0; y < result.resolution; y++) {
        for (let x = 0; x < result.resolution; x++) {
          const i = y * result.resolution + x;
          cells.push({
            x,
            y,
            elevation: Number(result.heightMap[i]!.toFixed(2)),
            moisture: Number(result.moistureMap[i]!.toFixed(3)),
            temperature: Number(result.temperatureMap[i]!.toFixed(2)),
            biome: mod.idToBiome ? mod.idToBiome(result.biomeMap[i]!) : String(result.biomeMap[i]),
          });
        }
      }
      return {
        seed: result.seed,
        resolution: result.resolution,
        cells,
        regions: result.regions,
        source: 'simulation-models',
      };
    }
  } catch {
    // fallback
  }
  return localGenerate(seed, resolution);
}
