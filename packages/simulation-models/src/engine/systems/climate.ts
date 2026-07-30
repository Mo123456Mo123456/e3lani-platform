/**
 * Climate system — a simplified but causal climate model.
 *
 * Drivers: latitude baseline, a slow multi-decadal oscillation, greenhouse
 * forcing from pollution, volcanic cooling, vegetation feedback, and
 * neighbor smoothing (cellular automaton). Droughts, wildfires, floods and
 * eruptions are emitted as events with explicit physical causes.
 */
import { clamp, clamp01 } from "../../noise";
import { buildPlantIndex, type WorldState } from "../state";
import type { SystemCtx } from "../engine";

const OSCILLATION_TICKS = 48; // slow multi-century climate cycle

export function climateSystem(ctx: SystemCtx): void {
  const { state, rng, emit } = ctx;
  const grid = state.grid;
  const plantIndex = buildPlantIndex(state);

  // --- global forcing ------------------------------------------------------
  let totalPollution = 0;
  let vegetation = 0;
  for (const cell of grid.cells) {
    totalPollution += cell.pollution;
    vegetation += vegetationCover(cell.index, plantIndex);
  }
  const meanPollution = totalPollution / grid.cells.length;
  const greenhouse = meanPollution * 0.25;
  state.climate.volcanicForcing *= 0.94; // ash settles over time
  const phase = Math.sin((state.tick / OSCILLATION_TICKS) * Math.PI * 2);
  const targetGlobal = clamp01(0.5 + phase * 0.05 + greenhouse - state.climate.volcanicForcing);
  const previousGlobal = state.climate.globalTemp;
  state.climate.globalTemp = clamp01(state.climate.globalTemp + (targetGlobal - state.climate.globalTemp) * 0.15);

  const warming = state.climate.globalTemp - 0.5;
  if (Math.abs(state.climate.globalTemp - previousGlobal) > 0.002 && rng.chance(0.06)) {
    emit({
      type: "CLIMATE_CHANGED",
      cell: -1,
      causeIds: [],
      cause:
        greenhouse > 0.03
          ? "greenhouse forcing from accumulated pollution"
          : state.climate.volcanicForcing > 0.02
            ? "volcanic aerosol cooling"
            : "multi-century climate oscillation",
      data: {
        globalTemp: Math.round(state.climate.globalTemp * 1000) / 1000,
        greenhouse: Math.round(greenhouse * 1000) / 1000,
      },
      importance: 0.6,
    });
  }

  // --- per-cell update -------------------------------------------------------
  for (const cell of grid.cells) {
    const latBase = 1 - Math.pow(Math.abs(cell.lat) / 90, 1.25);
    const targetTemp = clamp01(latBase - Math.max(0, cell.height) * 0.38 + warming * 0.35);
    const before = cell.temperature;
    cell.temperature = clamp01(cell.temperature + (targetTemp - cell.temperature) * 0.12);

    // neighbor smoothing keeps fields coherent (cellular automaton step)
    if (rng.chance(0.3)) {
      let sum = 0;
      let n = 0;
      for (const ni of grid.neighbors[cell.index]!) {
        sum += grid.cells[ni]!.moisture;
        n++;
      }
      if (n > 0) cell.moisture = clamp01(cell.moisture * 0.92 + (sum / n) * 0.08);
    }

    if (cell.height < grid.seaLevel) continue;

    // plants drink and clean
    const cover = vegetationCover(cell.index, plantIndex);
    if (cover > 0) {
      cell.moisture = clamp01(cell.moisture - cover * 0.004);
      cell.pollution = clamp01(cell.pollution - cover * 0.01);
    }
    cell.pollution = clamp01(cell.pollution * 0.985); // natural decay
    if (Math.abs(before - cell.temperature) < 1e-9) {
      // no-op guard: keeps the loop explicit about mutation
    }

    updateDrought(ctx, cell.index);
    maybeWildfire(ctx, cell.index, rngNext(rng));
    maybeFlood(ctx, cell.index);
    maybeEruption(ctx, cell.index);
    maybeDesertification(state, cell.index);
    maybeIceMelt(state, cell.index);
  }
}

function vegetationCover(cell: number, plantIndex: Map<number, { coverage: Record<number, number> }[]>): number {
  const plants = plantIndex.get(cell);
  if (!plants) return 0;
  let cover = 0;
  for (const p of plants) cover += p.coverage[cell] ?? 0;
  return Math.min(1, cover);
}

function updateDrought(ctx: SystemCtx, index: number): void {
  const { state, emit } = ctx;
  const cell = state.grid.cells[index]!;
  const streaks = state.climate.droughtStreak;
  if (cell.moisture < 0.14) {
    streaks[index] = (streaks[index] ?? 0) + 1;
    if (streaks[index] === 6) {
      emit({
        type: "DROUGHT_STARTED",
        cell: index,
        causeIds: [],
        cause: "six consecutive ticks of critically low moisture",
        data: { moisture: Math.round(cell.moisture * 1000) / 1000 },
        importance: 0.55,
      });
      cell.fertility = clamp01(cell.fertility - 0.15);
    }
  } else if (streaks[index]) {
    delete streaks[index];
  }
}

function maybeWildfire(ctx: SystemCtx, index: number, roll: number): void {
  const { state, emit } = ctx;
  const cell = state.grid.cells[index]!;
  const forest = cell.biome === "temperate_forest" || cell.biome === "rainforest";
  if (!forest || cell.temperature < 0.6 || cell.moisture > 0.3) return;
  if (roll > 0.012) return;
  emit({
    type: "WILDFIRE_STARTED",
    cell: index,
    causeIds: [],
    cause: "hot dry conditions ignited forest cover",
    data: { temperature: round3(cell.temperature), moisture: round3(cell.moisture) },
    importance: 0.5,
  });
  cell.pollution = clamp01(cell.pollution + 0.15);
  cell.fertility = clamp01(cell.fertility - 0.1);
}

function maybeFlood(ctx: SystemCtx, index: number): void {
  const { state, rng, emit } = ctx;
  const cell = state.grid.cells[index]!;
  if (!cell.river || cell.moisture < 0.88 || !rng.chance(0.05)) return;
  emit({
    type: "FLOOD_OCCURRED",
    cell: index,
    causeIds: [],
    cause: "saturated watershed overflowed the river banks",
    data: { moisture: round3(cell.moisture) },
    importance: 0.45,
  });
  cell.fertility = clamp01(cell.fertility + 0.08); // silt deposition
}

function maybeEruption(ctx: SystemCtx, index: number): void {
  const { state, rng, emit } = ctx;
  const cell = state.grid.cells[index]!;
  if (!cell.volcanic || !rng.chance(0.006)) return;
  emit({
    type: "VOLCANO_ERUPTED",
    cell: index,
    causeIds: [],
    cause: "tectonic pressure release along the plate boundary",
    data: { forcing: 0.05 },
    importance: 0.8,
  });
  state.climate.volcanicForcing = clamp01(state.climate.volcanicForcing + 0.05);
  cell.pollution = clamp01(cell.pollution + 0.3);
  // eruptions fertilize volcanic soils and may expose minerals
  cell.fertility = clamp01(cell.fertility + 0.1);
  if (rng.chance(0.35)) {
    cell.resources.push({
      id: `res-${index}-ash-${state.tick}`,
      type: rng.chance(0.5) ? "crystal" : "gold",
      quantity: rng.int(40, 160),
      renewRate: 0,
      value: 0.9,
      discovered: false,
    });
  }
}

function maybeDesertification(state: WorldState, index: number): void {
  const cell = state.grid.cells[index]!;
  if (cell.biome !== "plains" && cell.biome !== "steppe") return;
  const streak = state.climate.droughtStreak[index] ?? 0;
  if (streak >= 12 && cell.moisture < 0.16 && cell.temperature > 0.5) {
    cell.biome = "desert";
    cell.fertility = clamp01(cell.fertility * 0.4);
  }
}

function maybeIceMelt(state: WorldState, index: number): void {
  const cell = state.grid.cells[index]!;
  if (cell.biome !== "ice" && cell.biome !== "tundra") return;
  if (cell.temperature > 0.16 && cell.biome === "ice") cell.biome = "tundra";
  else if (cell.temperature > 0.3 && cell.biome === "tundra" && cell.height >= state.grid.seaLevel) {
    cell.biome = cell.moisture > 0.4 ? "plains" : "steppe";
  }
}

function rngNext(rng: { next(): number }): number {
  return rng.next();
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
