#!/usr/bin/env node
import { generatePlanet } from './generator.js';

async function main() {
  const seed = process.argv[2] || `seed-${Date.now()}`;
  const resolution = Number(process.argv[3] || 32);
  const result = await generatePlanet(seed, resolution);
  console.log(JSON.stringify({ seed: result.seed, resolution: result.resolution, cells: result.cells.length, source: result.source }, null, 2));
}

main();
