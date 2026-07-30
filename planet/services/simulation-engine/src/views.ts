import {
  CivRelation,
  GovernmentType,
  type CivilizationDTO,
  type CityDTO,
  type RegionInfo,
  type WorldMeta,
  type WorldSnapshotView,
  type WorldStats,
} from "@planet/shared-types";
import {
  biomeFromIndex,
  cellLat,
  cellLon,
  cellXY,
  getRelation,
  speciesPopulation,
  type WorldState,
} from "@planet/simulation-models";

/** Projections from engine state to API-friendly DTOs. */

export function worldMeta(world: WorldState): WorldMeta {
  return {
    id: world.id,
    name: world.name,
    seed: world.seed,
    tick: world.tick,
    year: world.tick * world.yearsPerTick,
    yearsPerTick: world.yearsPerTick,
    gridWidth: world.grid.width,
    gridHeight: world.grid.height,
    createdAt: new Date(0).toISOString(),
    paused: false,
  };
}

export function worldStats(world: WorldState): WorldStats {
  let pollution = 0;
  let temperature = 0;
  for (let i = 0; i < world.grid.cellCount; i++) {
    pollution += world.grid.pollution[i] ?? 0;
    temperature += world.grid.temperature[i] ?? 0;
  }
  const livingCivs = world.civs.filter((c) => !c.fallen);
  return {
    species: world.species.filter((s) => s.kind === "fauna" && !s.extinct).length,
    plants: world.species.filter((s) => s.kind === "flora" && !s.extinct).length,
    civs: livingCivs.length,
    cities: world.cities.filter((c) => !c.fallen).length,
    technologies: world.techs.length,
    activeWars: world.wars.filter((w) => w.endedTick === undefined).length,
    alliances: world.alliances.filter((a) => !a.brokenTick).length,
    tradeRoutes: world.tradeRoutes.filter((r) => r.active).length,
    avgTemperature: temperature / world.grid.cellCount,
    avgPollution: pollution / world.grid.cellCount,
    totalPopulation: livingCivs.reduce((s, c) => s + c.population, 0),
  };
}

export function snapshotView(world: WorldState): WorldSnapshotView {
  const civs: CivilizationDTO[] = world.civs.map((c) => ({
    id: c.id,
    name: c.name,
    population: Math.round(c.population),
    capitalCell: c.capitalCell,
    cells: c.cells,
    techLevel: c.techLevel,
    government: c.government as GovernmentType,
    military: c.military,
    economy: c.economy,
    stability: c.stability,
    happiness: c.happiness,
    pollution: c.pollutionOutput,
    culture: c.culture,
    language: c.language,
    fallen: c.fallen,
    foundedTick: c.foundedTick,
  }));
  const cities: CityDTO[] = world.cities.map((c) => ({
    id: c.id,
    name: c.name,
    civId: c.civId,
    cell: c.cell,
    population: Math.round(c.population),
    foundedTick: c.foundedTick,
    fallen: c.fallen,
  }));
  const relations: { a: number; b: number; relation: CivRelation }[] = [];
  for (let i = 0; i < world.civs.length; i++) {
    for (let j = i + 1; j < world.civs.length; j++) {
      const a = world.civs[i]!.id;
      const b = world.civs[j]!.id;
      const v = getRelation(world, a, b);
      const atWar = world.wars.some(
        (w) => w.endedTick === undefined &&
          ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)),
      );
      relations.push({
        a, b,
        relation: atWar ? CivRelation.War : v > 0.45 ? CivRelation.Alliance : v > 0.15 ? CivRelation.Trade : v < -0.4 ? CivRelation.Hostile : CivRelation.Neutral,
      });
    }
  }
  return {
    meta: worldMeta(world),
    stats: worldStats(world),
    civs,
    cities,
    tradeRoutes: world.tradeRoutes.map((r) => ({ id: r.id, fromCity: r.fromCity, toCity: r.toCity, path: r.path, active: r.active })),
    wars: world.wars.map((w) => ({
      id: w.id, attackerCiv: w.attacker, defenderCiv: w.defender,
      startedTick: w.startedTick, endedTick: w.endedTick,
      casualties: Math.round(w.casualties), reason: w.reason,
    })),
    alliances: world.alliances.map((a) => ({ id: a.id, civIds: a.civIds, createdTick: a.createdTick, brokenTick: a.brokenTick })),
    relations,
  };
}

export function regionInfo(world: WorldState, cellIndex: number): RegionInfo | null {
  const g = world.grid;
  if (cellIndex < 0 || cellIndex >= g.cellCount) return null;
  const [x, y] = cellXY(g.width, cellIndex);
  const civ = world.civs.find((c) => !c.fallen && c.cells.includes(cellIndex));
  const city = world.cities.find((c) => !c.fallen && c.cell === cellIndex);
  let speciesCount = 0;
  let plantCount = 0;
  for (const s of world.species) {
    if (s.extinct) continue;
    if ((s.cells[String(cellIndex)] ?? 0) > 0) {
      if (s.kind === "flora") plantCount++;
      else speciesCount++;
    }
  }
  return {
    cellIndex,
    lat: cellLat(g.height, y),
    lon: cellLon(g.width, x),
    biome: biomeFromIndex(g.biome[cellIndex] ?? 0),
    height: g.elevation[cellIndex] ?? 0,
    temperature: g.temperature[cellIndex] ?? 0,
    moisture: g.moisture[cellIndex] ?? 0,
    pollution: g.pollution[cellIndex] ?? 0,
    fertility: g.fertility[cellIndex] ?? 0,
    river: (g.river[cellIndex] ?? 0) === 1,
    civId: civ?.id,
    cityId: city?.id,
    resources: world.deposits
      .filter((d) => d.cell === cellIndex && !d.depleted)
      .map((d) => ({ kind: d.kind, quantity: Math.round(d.quantity) })),
    speciesCount,
    plantCount,
  };
}

/** Downsampled grid channels for the 3D client (biome/height/temp/moisture/pollution/ice/river). */
export function gridView(world: WorldState): {
  width: number; height: number; seaLevel: number;
  elevation: number[]; biome: number[]; temperature: number[];
  moisture: number[]; pollution: number[]; ice: number[]; river: number[];
} {
  const g = world.grid;
  const quantize = (arr: Float32Array, scale: number) =>
    Array.from(arr, (v) => Math.round(v * scale));
  return {
    width: g.width,
    height: g.height,
    seaLevel: g.seaLevel,
    elevation: quantize(g.elevation, 1000),
    biome: Array.from(g.biome),
    temperature: quantize(g.temperature, 1000),
    moisture: quantize(g.moisture, 1000),
    pollution: quantize(g.pollution, 1000),
    ice: quantize(g.ice, 1000),
    river: Array.from(g.river),
  };
}

export function speciesView(world: WorldState, contributionId?: string) {
  return world.species
    .filter((s) => !s.extinct)
    .filter((s) => (contributionId ? s.contributionId === contributionId : true))
    .map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      population: Math.round(speciesPopulation(s)),
      cells: Object.keys(s.cells).map(Number),
      diet: s.diet,
      size: s.size,
      nightLuminosity: s.nightLuminosity,
      contributionId: s.contributionId,
    }));
}
