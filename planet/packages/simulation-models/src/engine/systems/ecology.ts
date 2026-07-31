import { WorldEventType, BiomeType } from "@planet/shared-types";
import { clamp01, neighbors4 } from "../../math.js";
import { chance, random, range } from "../../rng.js";
import { BIOME_ORDER } from "../../planet/types.js";
import { emitEvent } from "../events.js";
import { nextId, speciesPopulation, type Species, type WorldState } from "../types.js";
import { speciesName } from "../names.js";

const EXTINCTION_THRESHOLD = 2;
const CELL_CAPACITY_BASE = 400;

/** Habitat suitability 0..1 — mirrors the generator so spread stays coherent. */
export function habitatSuitability(world: WorldState, s: Species, cell: number): number {
  const g = world.grid;
  const b = BIOME_ORDER[g.biome[cell] ?? 0] ?? BiomeType.Ocean;
  if (s.kind === "flora" && b === BiomeType.Ocean) return 0;
  const temp = g.temperature[cell] ?? 0;
  const tempFit = temp >= 0
    ? 1 - (1 - s.heatResistance) * clamp01(Math.abs(temp - 0.35))
    : 1 - (1 - s.coldResistance) * clamp01(Math.abs(temp + 0.35));
  const waterFit = 1 - Math.abs((g.moisture[cell] ?? 0) - s.waterNeed);
  const pollutionPenalty = (g.pollution[cell] ?? 0) * (1 - s.adaptability);
  return clamp01(clamp01(tempFit) * clamp01(waterFit) * (1 - pollutionPenalty) * 1.3);
}

function carryingCapacity(world: WorldState, s: Species, cell: number): number {
  const g = world.grid;
  const fertility = g.fertility[cell] ?? 0;
  const suit = habitatSuitability(world, s, cell);
  const sizeFactor = 1 - s.size * 0.7;
  return CELL_CAPACITY_BASE * fertility * suit * sizeFactor + 1;
}

/**
 * Ecology: logistic growth toward carrying capacity, Lotka–Volterra-inspired
 * predation, cellular spread to suitable neighbours, mutation and extinction.
 */
const MAX_SPECIES = 1500;
const MUTATIONS_PER_TICK = 2;

export function applyEcology(world: WorldState): void {
  const plantGrowthLaw = world.laws.find((l) => l.modifier === "plantGrowthMultiplier");
  const byId = new Map(world.species.map((s) => [s.id, s]));
  // floraId -> grazing species (built once per tick, not per cell).
  const preyMap = new Map<number, Species[]>();
  for (const s of world.species) {
    if (s.kind !== "fauna" || s.extinct || s.diet === "carnivore") continue;
    for (const preyId of s.prey) {
      const list = preyMap.get(preyId) ?? [];
      list.push(s);
      preyMap.set(preyId, list);
    }
  }
  let mutationBudget = world.species.length < MAX_SPECIES ? MUTATIONS_PER_TICK : 0;

  for (const s of world.species) {
    if (s.extinct) continue;
    const cells = Object.keys(s.cells);
    for (const key of cells) {
      const cell = Number(key);
      const pop = s.cells[key] ?? 0;
      if (pop <= 0) {
        delete s.cells[key];
        continue;
      }
      const cap = carryingCapacity(world, s, cell);
      let growth = s.reproductionRate * (s.kind === "flora" ? 0.35 : 0.2);
      if (s.kind === "flora" && plantGrowthLaw) growth *= plantGrowthLaw.factor;

      // Logistic term.
      let next = pop + pop * growth * (1 - pop / cap);

      // Predation pressure in this cell.
      for (const predId of s.predators) {
        const pred = byId.get(predId);
        if (!pred || pred.extinct) continue;
        const predPop = pred.cells[key] ?? 0;
        if (predPop > 0) {
          next -= 0.08 * predPop * pop / (pop + 40);
        }
      }
      // Herbivores consume flora in the cell.
      if (s.kind === "flora") {
        for (const grazer of preyMap.get(s.id) ?? []) {
          next -= (grazer.cells[key] ?? 0) * 0.15;
        }
      }

      // Deaths from unsuitable habitat.
      const suit = habitatSuitability(world, s, cell);
      if (suit < 0.2) next -= pop * (0.2 - suit) * 0.5;

      s.cells[key] = Math.max(0, next);

      // Spread to a suitable neighbour.
      if ((s.cells[key] ?? 0) > cap * 0.6 && chance(world.rng, "ecology", s.reproductionRate * 0.3)) {
        const ns = neighbors4(world.grid.width, world.grid.height, cell);
        const n = ns[Math.floor(random(world.rng, "ecology") * ns.length)] as number;
        if ((s.cells[String(n)] ?? 0) === 0 && habitatSuitability(world, s, n) > 0.3) {
          s.cells[String(n)] = (s.cells[key] ?? 0) * 0.1;
          if (s.kind === "flora" && chance(world.rng, "ecology", 0.25)) {
            emitEvent(world, {
              type: WorldEventType.PlantSpread,
              cellIndex: n,
              payload: { speciesId: s.id, name: s.name },
              contributionId: s.contributionId,
              causes: s.contributionId ? [world.contributionRoots[s.contributionId] ?? 0].filter((x) => x > 0) : [],
              importance: 0.15,
            });
          }
        }
      }
    }

    // Carnivores/omnivores gain from prey abundance (Lotka–Volterra coupling).
    if (s.kind === "fauna" && s.diet !== "herbivore") {
      for (const key of Object.keys(s.cells)) {
        const cell = key;
        let food = 0;
        for (const preyId of s.prey) {
          const prey = byId.get(preyId);
          if (prey && !prey.extinct) food += prey.cells[cell] ?? 0;
        }
        const pop = s.cells[cell] ?? 0;
        if (food < pop * 0.5) s.cells[cell] = pop * 0.92; // starvation
        else s.cells[cell] = pop * 1.03; // well fed
      }
    }

    // Range limit: keep the strongest cells, bounding per-tick cost.
    const keys = Object.keys(s.cells);
    if (keys.length > 60) {
      keys.sort((a, b) => (s.cells[b] ?? 0) - (s.cells[a] ?? 0));
      for (const k of keys.slice(60)) delete s.cells[k];
    }

    // Extinction check.
    if (speciesPopulation(s) < EXTINCTION_THRESHOLD) {
      s.extinct = true;
      emitEvent(world, {
        type: WorldEventType.SpeciesExtinct,
        payload: { speciesId: s.id, name: s.name, kind: s.kind },
        contributionId: s.contributionId,
        causes: s.contributionId ? [world.contributionRoots[s.contributionId] ?? 0].filter((x) => x > 0) : [],
        importance: 0.45,
      });
      continue;
    }

    // Mutation: a subspecies with perturbed traits. Globally budgeted so
    // species count stays bounded over millennia of ticks.
    if (mutationBudget > 0 && chance(world.rng, "mutation", s.mutationRate * (0.5 + s.adaptability) * 0.25)) {
      mutationBudget -= 1;
      const child: Species = {
        ...s,
        id: nextId(world, "species"),
        name: speciesName(world.rng, "mutation"),
        cells: {},
        prey: [...s.prey],
        predators: [...s.predators],
        parentSpecies: s.id,
        extinct: false,
        bornTick: world.tick,
        size: clamp01(s.size + range(world.rng, "mutation", -0.1, 0.1)),
        reproductionRate: clamp01(s.reproductionRate + range(world.rng, "mutation", -0.08, 0.08)),
        coldResistance: clamp01(s.coldResistance + range(world.rng, "mutation", -0.1, 0.1)),
        heatResistance: clamp01(s.heatResistance + range(world.rng, "mutation", -0.1, 0.1)),
        adaptability: clamp01(s.adaptability + range(world.rng, "mutation", -0.05, 0.1)),
      };
      // Subspecies buds off in one occupied cell.
      const home = Object.keys(s.cells)[0];
      if (home !== undefined) {
        child.cells[home] = (s.cells[home] ?? 0) * 0.15;
        s.cells[home] = (s.cells[home] ?? 0) * 0.85;
        world.species.push(child);
        byId.set(child.id, child);
        emitEvent(world, {
          type: WorldEventType.SpeciesMutated,
          cellIndex: Number(home),
          payload: { from: s.id, to: child.id, name: child.name },
          contributionId: s.contributionId,
          causes: s.contributionId ? [world.contributionRoots[s.contributionId] ?? 0].filter((x) => x > 0) : [],
          importance: 0.3,
        });
      }
    }
  }

  // Flora absorbs pollution where it lives.
  for (const s of world.species) {
    if (s.kind !== "flora" || s.extinct || s.pollutionAbsorption <= 0) continue;
    for (const key of Object.keys(s.cells)) {
      const i = Number(key);
      const g = world.grid;
      g.pollution[i] = Math.max(0, (g.pollution[i] ?? 0) - s.pollutionAbsorption * 0.01 * Math.log10((s.cells[key] ?? 0) + 1));
    }
  }
}
