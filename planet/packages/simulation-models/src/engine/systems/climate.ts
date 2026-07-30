import { BiomeType, WorldEventType } from "@planet/shared-types";
import { clamp01, neighbors4 } from "../../math.js";
import { chance, random } from "../../rng.js";
import { classifyCell } from "../../planet/biomes.js";
import { BIOME_ORDER } from "../../planet/types.js";
import { emitEvent } from "../events.js";
import type { WorldState } from "../types.js";

/**
 * Climate system: seasonal temperature oscillation, moisture advection,
 * pollution diffusion/absorption, ice melt and natural disasters.
 * Cellular-automata style diffusion on the grid; every change has a driver.
 */
export function applyClimate(world: WorldState): void {
  const g = world.grid;
  const year = world.tick * world.yearsPerTick;
  const season = Math.sin((year % 1) * Math.PI * 2); // yearly cycle

  const volcanoLaw = world.laws.find((l) => l.modifier === "volcanoSuppression");
  const pollutionCap = world.laws.find((l) => l.modifier === "pollutionCap");

  for (let i = 0; i < g.cellCount; i++) {
    const lat = 0.5 - Math.floor(i / g.width) / g.height;
    const seasonal = Math.sin(lat * Math.PI) * season * 0.12;
    const base = g.temperature[i] ?? 0;
    // Relax toward a seasonal target rather than drifting randomly.
    g.temperature[i] = base + (seasonal - base * 0.02) * 0.05;

    // Pollution diffusion + natural absorption by vegetation.
    const p = g.pollution[i] ?? 0;
    if (p > 0.001) {
      const ns = neighbors4(g.width, g.height, i);
      let flow = 0;
      for (const n of ns) flow += Math.max(0, p - (g.pollution[n] ?? 0)) * 0.04;
      const b = BIOME_ORDER[g.biome[i] ?? 0];
      const vegetation = b === BiomeType.Rainforest || b === BiomeType.TemperateForest || b === BiomeType.Swamp ? 0.02 : 0.004;
      g.pollution[i] = Math.max(0, p - flow - p * vegetation);
      for (const n of ns) {
        g.pollution[n] = clamp01((g.pollution[n] ?? 0) + flow / ns.length);
      }
    }
    if (pollutionCap && (g.pollution[i] ?? 0) > pollutionCap.factor) {
      g.pollution[i] = pollutionCap.factor;
    }

    // Ice dynamics.
    if ((g.temperature[i] ?? 0) < -0.45) {
      g.ice[i] = clamp01((g.ice[i] ?? 0) + 0.02);
    } else if ((g.ice[i] ?? 0) > 0) {
      g.ice[i] = Math.max(0, (g.ice[i] ?? 0) - 0.03);
      if ((g.ice[i] ?? 0) === 0 && (g.elevation[i] ?? 0) < g.seaLevel + 0.01) {
        g.seaLevel += 0.0000005; // meltwater accumulates globally
      }
    }
  }

  // Moisture advection along prevailing winds (one relaxation pass).
  for (let y = 0; y < g.height; y++) {
    const eastward = g.windDir[y * g.width] === 0;
    for (let k = 0; k < g.width; k++) {
      const x = eastward ? k : g.width - 1 - k;
      const i = y * g.width + x;
      if ((g.elevation[i] ?? 0) <= g.seaLevel) continue;
      const prevX = eastward ? (x - 1 + g.width) % g.width : (x + 1) % g.width;
      const carried = (g.moisture[y * g.width + prevX] ?? 0) * 0.99;
      if (carried > (g.moisture[i] ?? 0)) g.moisture[i] = clamp01((g.moisture[i]! + carried) / 2);
    }
  }

  // Biomes reclassify as conditions drift (desertification, forest dieback…).
  if (world.tick % 5 === 0) {
    for (let i = 0; i < g.cellCount; i++) {
      g.biome[i] = BIOME_ORDER.indexOf(classifyCell(g, i));
    }
  }

  // --- Natural disasters (probability driven by geology/climate) ----------
  const disasterChance = 0.004 * (volcanoLaw ? 1 - volcanoLaw.factor : 1);
  if (world.tick % 3 === 0) {
    for (let i = 0; i < g.cellCount; i++) {
      const v = g.volcanic[i] ?? 0;
      if (v > 0.5 && chance(world.rng, "disaster", disasterChance * v)) {
        for (const n of [i, ...neighbors4(g.width, g.height, i)]) {
          g.pollution[n] = clamp01((g.pollution[n] ?? 0) + 0.3);
          g.temperature[n] = (g.temperature[n] ?? 0) - 0.05; // ash veil
        }
        emitEvent(world, {
          type: WorldEventType.VolcanoErupted,
          cellIndex: i,
          payload: { intensity: v },
          importance: 0.7,
        });
        break; // one eruption per pass keeps the feed readable
      }
    }
  }

  // Wildfires: hot, dry forests.
  if (chance(world.rng, "wildfire", 0.05)) {
    for (let i = 0; i < g.cellCount; i++) {
      const b = BIOME_ORDER[g.biome[i] ?? 0];
      const forest = b === BiomeType.TemperateForest || b === BiomeType.Rainforest;
      if (forest && (g.temperature[i] ?? 0) > 0.4 && (g.moisture[i] ?? 0) < 0.2 && chance(world.rng, "wildfire", 0.02)) {
        g.moisture[i] = Math.max(0, (g.moisture[i] ?? 0) - 0.1);
        g.pollution[i] = clamp01((g.pollution[i] ?? 0) + 0.1);
        emitEvent(world, {
          type: WorldEventType.WildfireStarted,
          cellIndex: i,
          payload: { biome: b },
          importance: 0.4,
        });
        break;
      }
    }
  }

  // Floods: river cells after moisture spikes.
  if (chance(world.rng, "flood", 0.04)) {
    const riverCells: number[] = [];
    for (let i = 0; i < g.cellCount; i++) {
      if (g.river[i] === 1 && (g.moisture[i] ?? 0) > 0.75) riverCells.push(i);
    }
    if (riverCells.length > 0) {
      const i = riverCells[Math.floor(random(world.rng, "flood") * riverCells.length)] as number;
      g.fertility[i] = clamp01((g.fertility[i] ?? 0) + 0.05); // silt renews soil
      emitEvent(world, {
        type: WorldEventType.FloodOccurred,
        cellIndex: i,
        payload: {},
        importance: 0.35,
      });
    }
  }
}
