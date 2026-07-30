import { clamp, clamp01, type SystemContext } from "../context.js";
import { deterministicId } from "../rng.js";
import type { CellState, SpeciesStateInternal } from "../types.js";

/**
 * Ecosystem tick: vegetation regrowth, contribution-plant spread with real
 * cell-level effects, Lotka–Volterra-inspired predator/prey dynamics,
 * habitat-driven migration, mutation and extinction.
 */
export function tickEcology(ctx: SystemContext): void {
  const { grid, state, rng, emit, touch, yearsPerTick } = ctx;
  let eventsLeft = 8;
  const orLife = (ids: Array<string | undefined>): string[] => {
    const clean = ids.filter((x): x is string => !!x);
    return clean.length > 0 ? clean : [ctx.genesisIds.life];
  };

  // --- vegetation regrowth toward carrying capacity -------------------------
  for (const c of state.cells) {
    if (c.isOcean) continue;
    const droughtPenalty = c.droughtTicks > 0 ? 0.35 : 1;
    const capacity = clamp01(c.fertility * c.moisture * droughtPenalty * (1 - c.pollution * 0.6));
    const prev = c.plantCoverage;
    c.plantCoverage = clamp01(c.plantCoverage + (capacity - c.plantCoverage) * 0.12 * yearsPerTick);
    if (Math.abs(prev - c.plantCoverage) > 0.02) touch(c.index);
  }

  // --- tracked plants (user contributions) spread & act ----------------------
  for (const plant of state.plants.values()) {
    if (plant.extinct || plant.cells.size === 0) continue;
    const t = plant.traits;
    let addedThisTick = 0;
    for (const idx of [...plant.cells]) {
      const cell = state.cells[idx]!;
      // effects
      if (t.luminosity > 0.4 && cell.ownerCivId) {
        const civ = state.civs.get(cell.ownerCivId);
        if (civ) civ.happiness = clamp01(civ.happiness + 0.002 * t.luminosity * yearsPerTick);
      }
      if (t.energyStorage > 0.5 && cell.ownerCivId) {
        const civ = state.civs.get(cell.ownerCivId);
        if (civ && (civ.techKeys.has("electricity") || civ.techKeys.has("agriculture"))) {
          civ.economy = clamp01(civ.economy + 0.0015 * t.energyStorage * yearsPerTick);
        }
      }
      // spread
      if (addedThisTick >= 3 || !rng.chance(t.spreadRate * 0.12 * yearsPerTick)) continue;
      let bestIdx = -1;
      let bestScore = 0.2;
      for (const nb of grid.neighbors(idx)) {
        const n = state.cells[nb]!;
        if (plant.cells.has(nb) || n.isOcean) continue;
        const score = plantSuitability(n, t.waterNeed, t.heatResistance, t.coldResistance, plant.biomes);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = nb;
        }
      }
      if (bestIdx >= 0) {
        plant.cells.add(bestIdx);
        addedThisTick++;
        touch(bestIdx);
        if (eventsLeft > 0 && plant.cells.size % 25 === 0) {
          eventsLeft--;
          emit("PLANTS_SPREAD", {
            region: bestIdx,
            causeIds: orLife([ctx.lastEventByCell.get(bestIdx), plant.createdEventId]),
            contributionId: plant.originContributionId,
            magnitude: 0.3,
            title: `${plant.name} spreads`,
            summary: `${plant.name} colonised new territory (${plant.cells.size} regions).`,
            data: { coverage: plant.cells.size },
          });
        }
      }
    }
    if (plant.cells.size === 0) {
      plant.extinct = true;
      emit("SPECIES_EXTINCT", {
        region: null,
        causeIds: orLife([plant.createdEventId]),
        contributionId: plant.originContributionId,
        magnitude: 0.4,
        title: `${plant.name} died out`,
        summary: `${plant.name} could not survive the shifting climate.`,
        data: {},
      });
    }
  }

  // --- fauna -------------------------------------------------------------------
  const lastCauseBySpecies = new Map<string, string>();
  for (const sp of state.species.values()) lastCauseBySpecies.set(sp.id, sp.createdEventId ?? "");

  for (const sp of state.species.values()) {
    if (sp.extinct) continue;
    const pops = state.speciesPops.get(sp.id);
    if (!pops) continue;
    let global = 0;

    for (const [idx, pop] of [...pops]) {
      const cell = state.cells[idx]!;
      const suitability = habitatSuitability(cell, sp);
      const K = carryingCapacity(cell, sp, suitability);
      let p = pop;
      // logistic growth
      const r = sp.traits.reproductionRate * 0.25 * yearsPerTick;
      p = p + r * p * (1 - p / Math.max(1, K));
      // herbivores starve without vegetation
      if (sp.diet !== "meat" && cell.plantCoverage < 0.12 && !cell.isOcean) {
        p *= 1 - 0.25 * yearsPerTick * (0.12 - cell.plantCoverage) * 8;
      }
      // unsuitable habitat bleeds population
      if (suitability < 0.25) p *= 1 - 0.1 * yearsPerTick;
      // predation losses handled symmetrically below
      if (p < 5) {
        pops.delete(idx);
        continue;
      }
      pops.set(idx, p);
      global += p;

      // migration when overcrowded or habitat degrades
      if ((p > 0.92 * K || suitability < 0.3) && rng.chance(0.3 * yearsPerTick)) {
        let bestIdx = -1;
        let bestScore = suitability;
        for (const nb of grid.neighbors(idx)) {
          const n = state.cells[nb]!;
          const crossOcean = n.isOcean && cell.isOcean !== n.isOcean;
          const canCross = !crossOcean || sp.homeBiome === "ocean" === n.isOcean || (sp.traits.mobility > 0.85 && rng.chance(0.25));
          if (!canCross) continue;
          const s = habitatSuitability(n, sp);
          if (s > bestScore && (pops.get(nb) ?? 0) < carryingCapacity(n, sp, s) * 0.7) {
            bestScore = s;
            bestIdx = nb;
          }
        }
        if (bestIdx >= 0) {
          const isNewTerritory = !pops.has(bestIdx);
          const movers = p * 0.25;
          pops.set(idx, p - movers);
          pops.set(bestIdx, (pops.get(bestIdx) ?? 0) + movers);
          if (eventsLeft > 0 && isNewTerritory) {
            eventsLeft--;
            emit("SPECIES_MIGRATED", {
              region: bestIdx,
              causeIds: orLife([ctx.lastEventByCell.get(idx), lastCauseBySpecies.get(sp.id)]),
              contributionId: sp.originContributionId,
              magnitude: 0.2,
              title: `${sp.name} migrates`,
              summary: `${sp.name} expanded into a new ${state.cells[bestIdx]!.biome} region.`,
              data: { speciesId: sp.id },
            });
          }
        }
      }
    }

    // predation: predators consume prey sharing their cells
    if (sp.diet !== "plants") {
      for (const preyId of sp.preyIds) {
        const prey = state.species.get(preyId);
        const preyPops = state.speciesPops.get(preyId);
        if (!prey || prey.extinct || !preyPops) continue;
        for (const [idx, predPop] of [...pops]) {
          const preyHere = preyPops.get(idx);
          if (!preyHere) continue;
          const eaten = Math.min(preyHere * 0.08 * yearsPerTick, predPop * 0.5);
          preyPops.set(idx, preyHere - eaten);
          pops.set(idx, predPop + eaten * 0.1);
          if ((preyPops.get(idx) ?? 0) < 5) preyPops.delete(idx);
        }
      }
    }

    // extinction
    if (global < 20 && pops.size <= 1) {
      const lastCell = [...pops.keys()][0];
      sp.extinct = true;
      sp.extinctTick = state.tick;
      pops.clear();
      const cause = (lastCell !== undefined ? ctx.lastEventByCell.get(lastCell) : undefined) ?? lastCauseBySpecies.get(sp.id);
      emit("SPECIES_EXTINCT", {
        region: null,
        causeIds: orLife([cause]),
        contributionId: sp.originContributionId,
        magnitude: 0.5,
        title: `${sp.name} went extinct`,
        summary: `${sp.name} could no longer sustain a viable population.`,
        data: { speciesId: sp.id, homeBiome: sp.homeBiome },
      });
      continue;
    }

    // mutation under stress or by chance
    const stress = pops.size > 0 ? 1 - clamp01(global / (pops.size * 3000)) : 1;
    if (rng.chance(sp.traits.mutationRate * 0.02 * (1 + stress) * yearsPerTick) && eventsLeft > 0) {
      eventsLeft--;
      const childId = deterministicId("sp", state.seed, "mut", state.tick, sp.id);
      const jitter = (v: number) => clamp01(v + rng.spread() * 0.15);
      const child: SpeciesStateInternal = {
        id: childId,
        name: `${sp.name} novus`,
        parentId: sp.id,
        originContributionId: sp.originContributionId,
        homeBiome: sp.homeBiome,
        traits: {
          size: jitter(sp.traits.size),
          lifespan: jitter(sp.traits.lifespan),
          reproductionRate: jitter(sp.traits.reproductionRate),
          heatResistance: jitter(sp.traits.heatResistance),
          coldResistance: jitter(sp.traits.coldResistance),
          waterNeed: jitter(sp.traits.waterNeed),
          intelligence: jitter(sp.traits.intelligence),
          aggression: jitter(sp.traits.aggression),
          mobility: jitter(sp.traits.mobility),
          adaptability: clamp01(sp.traits.adaptability + 0.1),
          mutationRate: sp.traits.mutationRate,
        },
        diet: sp.diet,
        preyIds: [...sp.preyIds],
        createdTick: state.tick,
        createdEventId: undefined,
        extinct: false,
        extinctTick: null,
      };
      state.species.set(childId, child);
      const seedPops = new Map<number, number>();
      const origin = [...pops.keys()][0];
      if (origin !== undefined) seedPops.set(origin, 60);
      state.speciesPops.set(childId, seedPops);
      const ev = emit("SPECIES_MUTATED", {
        region: origin ?? null,
        causeIds: orLife([lastCauseBySpecies.get(sp.id)]),
        contributionId: sp.originContributionId,
        magnitude: 0.35,
        title: `${child.name} emerges`,
        summary: `A subspecies of ${sp.name} adapted to changing conditions.`,
        data: { parentId: sp.id, childId },
      });
      child.createdEventId = ev.id;
    }
  }
}

export function habitatSuitability(cell: CellState, sp: SpeciesStateInternal): number {
  const biomeFit = cell.biome === sp.homeBiome ? 1 : cell.isOcean === (sp.homeBiome === "ocean") ? 0.55 : 0.1;
  const t = cell.temperature;
  const tempFit = t > 25 ? sp.traits.heatResistance : t < 2 ? sp.traits.coldResistance : 0.8;
  const waterFit = cell.isOcean ? (sp.traits.waterNeed > 0.8 ? 1 : 0.2) : clamp01(1.2 - sp.traits.waterNeed * (1 - cell.moisture));
  const adapt = sp.traits.adaptability * 0.3;
  return clamp01(biomeFit * 0.45 + tempFit * 0.25 + waterFit * 0.2 + adapt);
}

function carryingCapacity(cell: CellState, sp: SpeciesStateInternal, suitability: number): number {
  const base = cell.isOcean ? 6000 : 4000 * cell.fertility + 800 * cell.plantCoverage;
  const sizePenalty = 1 - sp.traits.size * 0.8;
  return Math.max(50, base * suitability * sizePenalty);
}

function plantSuitability(cell: CellState, waterNeed: number, heatRes: number, coldRes: number, biomes: string[]): number {
  if (cell.isOcean) return 0;
  const biomeFit = biomes.includes(cell.biome) ? 1 : 0.35;
  const waterFit = clamp01(1.3 - waterNeed * (1 - cell.moisture));
  const tempFit = cell.temperature > 28 ? heatRes : cell.temperature < 0 ? coldRes : 0.85;
  return clamp01(biomeFit * 0.5 + waterFit * 0.3 + tempFit * 0.2);
}
