/// <reference lib="webworker" />
/**
 * Worldgen worker — procedural planet generation runs off the main thread.
 * Deterministic: the same seed yields the exact grid the server simulates.
 */
import { generatePlanet } from "@planet/simulation-models";

export interface GridRequest {
  seed: string;
  latBands: number;
  lonBands: number;
  seaLevel: number;
  riverCount?: number;
  resourceDensity?: number;
}

self.onmessage = (event: MessageEvent<GridRequest>) => {
  const { seed, latBands, lonBands, seaLevel, riverCount, resourceDensity } = event.data;
  const grid = generatePlanet({
    seed,
    latBands,
    lonBands,
    seaLevel,
    ...(riverCount !== undefined ? { riverCount } : {}),
    ...(resourceDensity !== undefined ? { resourceDensity } : {}),
  });
  self.postMessage({ grid });
};
