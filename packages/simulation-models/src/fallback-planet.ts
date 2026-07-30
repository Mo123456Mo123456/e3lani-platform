/**
 * Offline fallback planet generator: produces RGBA layer data from a seed
 * when the API is unreachable (PWA offline mode). Runs inside a Web Worker;
 * deliberately a simplified version of the server generator.
 */
import { classifyBiome, BIOME_PALETTE, SEA_LEVEL } from "./biomes";
import { SimplexNoise2D } from "./noise";

export interface FallbackPlanetResult {
  width: number;
  height: number;
  layers: Record<"biome" | "height" | "temperature" | "moisture", Uint8ClampedArray>;
}

export function generateFallbackPlanet(seed: number, lonBands = 72, latBands = 36): FallbackPlanetResult {
  const heightNoise = new SimplexNoise2D(seed);
  const continentNoise = new SimplexNoise2D(seed ^ 0x9e3779b9);
  const moistNoise = new SimplexNoise2D(seed ^ 0x3c6ef372);

  const biomeData = new Uint8ClampedArray(lonBands * latBands * 4);
  const heightData = new Uint8ClampedArray(lonBands * latBands * 4);
  const tempData = new Uint8ClampedArray(lonBands * latBands * 4);
  const moistData = new Uint8ClampedArray(lonBands * latBands * 4);

  const scale = 3 / latBands;
  const heights = new Float32Array(lonBands * latBands);
  for (let la = 0; la < latBands; la++) {
    for (let lo = 0; lo < lonBands; lo++) {
      const idx = la * lonBands + lo;
      const x = lo * scale;
      const y = la * scale * 2;
      const base = heightNoise.fbm(x, y, 5) * 0.5 + 0.5;
      const continent = continentNoise.fbm(x * 0.45, y * 0.45, 3) * 0.5 + 0.5;
      heights[idx] = Math.min(1, Math.max(0, base * 0.6 + continent * 0.4));
    }
  }

  const lerpC = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];

  for (let la = 0; la < latBands; la++) {
    const lat = -90 + (la + 0.5) * (180 / latBands);
    for (let lo = 0; lo < lonBands; lo++) {
      const idx = la * lonBands + lo;
      const h = heights[idx]!;
      const nearOcean =
        h > SEA_LEVEL &&
        [idx - 1, idx + 1, idx - lonBands, idx + lonBands].some(
          (n) => n >= 0 && n < heights.length && heights[n]! < SEA_LEVEL,
        );
      const baseT = 30 - (Math.abs(lat) / 90) * 62;
      const temp = h < SEA_LEVEL ? baseT * 0.9 - 2 : baseT - Math.max(0, h - SEA_LEVEL) * 55;
      const prox = nearOcean ? 0.45 : h < SEA_LEVEL ? 0.6 : 0.12;
      const moisture = Math.min(1, Math.max(0, (moistNoise.fbm(idx * 0.13, idx * 0.041, 4) * 0.5 + 0.5) * 0.5 + prox));
      const biome = classifyBiome(h, temp, moisture, nearOcean, false);

      const bp = BIOME_PALETTE[biome] ?? [255, 0, 255];
      biomeData.set([bp[0], bp[1], bp[2], 255], idx * 4);

      const hv = Math.round(h * 255);
      heightData.set([hv, hv, hv, 255], idx * 4);

      const tc = lerpC([40, 70, 180], [220, 60, 40], Math.min(1, Math.max(0, (temp + 40) / 80)));
      tempData.set([tc[0], tc[1], tc[2], 255], idx * 4);

      const mc = lerpC([190, 160, 110], [40, 90, 200], moisture);
      moistData.set([mc[0], mc[1], mc[2], 255], idx * 4);
    }
  }

  return {
    width: lonBands,
    height: latBands,
    layers: { biome: biomeData, height: heightData, temperature: tempData, moisture: moistData },
  };
}
