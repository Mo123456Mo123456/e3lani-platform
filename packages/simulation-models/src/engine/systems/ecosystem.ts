/**
 * Ecosystem system — plant growth/spread and a food-web population model
 * inspired by Lotka–Volterra dynamics:
 *  - producers (plants) track moisture/temperature/pollution
 *  - herbivores follow logistic growth bounded by plant biomass
 *  - predators transfer biomass from prey sharing their habitat
 *  - over-capacity populations migrate through suitable terrain only
 *  - low populations go extinct; mutation spawns subspecies
 */
import type { Biome, Plant, Species } from "@planet/shared-types";
import { clamp01 } from "../../noise";
import { generateName } from "../../names";
import { floodFill } from "../pathfinding";
import { nextEntityId, type WorldState } from "../state";
import type { SystemCtx } from "../engine";

const MIN_VIABLE_POPULATION = 12;

export function ecosystemSystem(ctx: SystemCtx): void {
  growPlants(ctx);
  stepSpecies(ctx);
}

// --------------------------------------------------------------------------
// Plants
// --------------------------------------------------------------------------

export function plantSuitability(plant: Plant, state: WorldState, cell: number): number {
  const c = state.grid.cells[cell]!;
  if (c.height < state.grid.seaLevel) return 0;
  let score = plant.suitableBiomes.includes(c.biome) ? 0.55 : 0.12;
  const tempStress =
    c.temperature > 0.7
      ? (c.temperature - 0.7) * (1 - plant.traits.heatResistance)
      : c.temperature < 0.3
        ? (0.3 - c.temperature) * (1 - plant.traits.coldResistance)
        : 0;
  const waterStress = Math.max(0, plant.traits.waterNeed - c.moisture);
  score += 0.45 - tempStress * 1.4 - waterStress * 1.1;
  return clamp01(score);
}

function growPlants(ctx: SystemCtx): void {
  const { state, rng, emit } = ctx;
  for (const plant of state.plants) {
    const cells = Object.keys(plant.coverage).map(Number);
    for (const cell of cells) {
      const suitability = plantSuitability(plant, state, cell);
      const coverage = plant.coverage[cell] ?? 0;
      const growth = plant.traits.growthRate * 0.12 * suitability * (1 - coverage);
      const stress = suitability < 0.2 ? 0.05 : 0;
      const next = clamp01(coverage + growth - stress);
      if (next < 0.03) delete plant.coverage[cell];
      else plant.coverage[cell] = next;

      // spread into a suitable neighbor
      if (next > 0.65 && rng.chance(plant.traits.growthRate * 0.2)) {
        const options = state.grid.neighbors[cell]!.filter(
          (n) => !(n in plant.coverage) && plantSuitability(plant, state, n) > 0.35,
        );
        if (options.length > 0) {
          const target = rng.pick(options);
          const targetCell = state.grid.cells[target]!;
          plant.coverage[target] = 0.25;
          const crossedSea = Math.abs(targetCell.lon - state.grid.cells[cell]!.lon) > 30;
          if (crossedSea || rng.chance(0.1)) {
            emit({
              type: "PLANT_SPREAD",
              cell: target,
              causeIds: [],
              cause: `vegetation expanded from cell ${cell}`,
              actors: [{ kind: "plant", id: plant.id, name: plant.name }],
              data: { biome: targetCell.biome },
              importance: 0.3,
              originContributionId: plant.originContributionId,
            });
          }
        }
      }
    }
  }
}

// --------------------------------------------------------------------------
// Species
// --------------------------------------------------------------------------

export function habitatSuitability(species: Species, state: WorldState, cell: number): number {
  const c = state.grid.cells[cell]!;
  const aquatic = species.traits.aquatic === true;
  if (c.height < state.grid.seaLevel) return aquatic ? 0.7 : 0;
  if (aquatic) return 0.05;
  let score = 0.5;
  if (c.biome === "ice" || c.biome === "volcanic") score -= 0.35;
  const heatStress = Math.max(0, c.temperature - 0.7) * (1 - species.traits.heatResistance);
  const coldStress = Math.max(0, 0.25 - c.temperature) * (1 - species.traits.coldResistance);
  const waterStress = Math.max(0, species.traits.waterNeed - c.moisture);
  score -= heatStress + coldStress + waterStress * 0.8;
  score += c.fertility * 0.25;
  return clamp01(score);
}

/** plant biomass available to herbivores in a cell */
function plantBiomass(state: WorldState, cell: number): number {
  let biomass = 0;
  for (const plant of state.plants) {
    const cov = plant.coverage[cell];
    if (cov) biomass += cov * (1 - (plant.traits.toxicity ?? 0));
  }
  return Math.min(1.5, biomass);
}

export function carryingCapacity(species: Species, state: WorldState): number {
  const base = 900 * (1.2 - species.traits.size);
  let capacity = 0;
  for (const cell of species.habitat) {
    const suit = habitatSuitability(species, state, cell);
    if (species.diet === "herbivore") capacity += suit * base * (0.25 + plantBiomass(state, cell));
    else if (species.diet === "producer") capacity += suit * base;
    else capacity += suit * base * 0.5; // predators bounded by prey below
  }
  return Math.max(40, capacity);
}

function stepSpecies(ctx: SystemCtx): void {
  const { state, rng, emit } = ctx;
  const alive = state.species.filter((s) => !s.extinctAtTick);

  // --- local growth + starvation -------------------------------------------
  for (const species of alive) {
    const K = carryingCapacity(species, state);
    const N = species.population;
    const r = species.traits.reproductionRate * 0.25;

    let foodFactor = 1;
    if (species.diet === "herbivore") {
      const biomass = species.habitat.reduce((sum, c) => sum + plantBiomass(state, c), 0);
      foodFactor = biomass > 0.2 ? 1 : 0.55; // starvation without forage
    } else if (species.diet === "carnivore") {
      const preyAvailable = totalPreyBiomass(species, state);
      foodFactor = preyAvailable > N * 0.05 ? 1 : 0.6;
    }

    const growth = r * N * (1 - N / K) * foodFactor;
    const stress = species.habitat.reduce((sum, c) => sum + (1 - habitatSuitability(species, state, c)), 0) /
      Math.max(1, species.habitat.length);
    const mortality = N * 0.03 * (1 + stress * 2);
    species.population = Math.max(0, Math.round(N + growth - mortality));

    maybeMigrate(ctx, species, K);
    maybeMutate(ctx, species);

    if (species.population < MIN_VIABLE_POPULATION) {
      species.extinctAtTick = state.tick;
      emit({
        type: "SPECIES_EXTINCT",
        cell: species.originCell,
        causeIds: [],
        cause:
          foodFactor < 1
            ? "food web collapse: insufficient prey or forage"
            : "population fell below the minimum viable threshold",
        actors: [{ kind: "species", id: species.id, name: species.name }],
        data: { finalPopulation: species.population, diet: species.diet },
        importance: 0.6,
        originContributionId: species.originContributionId,
      });
      // predators lose the prey link (cascades through the food web)
      for (const other of state.species) {
        other.preyIds = other.preyIds.filter((id) => id !== species.id);
      }
    }
  }

  // --- predation transfer (Lotka–Volterra inspired) -------------------------
  for (const predator of alive) {
    if (predator.diet !== "carnivore" || predator.extinctAtTick) continue;
    for (const preyId of predator.preyIds) {
      const prey = state.species.find((s) => s.id === preyId);
      if (!prey || prey.extinctAtTick) continue;
      const overlap = predator.habitat.filter((c) => prey.habitat.includes(c)).length;
      if (overlap === 0) continue;
      const transfer = Math.min(
        prey.population * 0.04,
        predator.population * 0.12 * predator.traits.aggression,
      ) * (overlap / Math.max(1, predator.habitat.length));
      prey.population = Math.max(0, Math.round(prey.population - transfer));
      predator.population = Math.round(predator.population + transfer * 0.25);
    }
  }
}

function totalPreyBiomass(predator: Species, state: WorldState): number {
  let total = 0;
  for (const preyId of predator.preyIds) {
    const prey = state.species.find((s) => s.id === preyId);
    if (prey && !prey.extinctAtTick) total += prey.population;
  }
  return total;
}

function maybeMigrate(ctx: SystemCtx, species: Species, capacity: number): void {
  const { state, rng, emit } = ctx;
  if (species.population < capacity * 0.85) return;
  if (!rng.chance(species.traits.mobility * 0.35)) return;

  // frontier of current habitat
  const frontier = new Set<number>();
  for (const cell of species.habitat) {
    for (const n of state.grid.neighbors[cell]!) {
      if (!species.habitat.includes(n)) frontier.add(n);
    }
  }
  const terrestrialPassable = (cell: number): boolean => {
    if (species.traits.aquatic) return state.grid.cells[cell]!.height < state.grid.seaLevel;
    return state.grid.cells[cell]!.height >= state.grid.seaLevel;
  };
  let bestCell = -1;
  let bestScore = 0.25;
  for (const cell of frontier) {
    if (!terrestrialPassable(cell)) continue;
    const suit = habitatSuitability(species, state, cell);
    if (suit > bestScore) {
      bestScore = suit;
      bestCell = cell;
    }
  }
  if (bestCell < 0) return;

  // verify reachability through suitable terrain (no impossible crossings)
  const reachable = floodFill(
    state.grid,
    species.habitat[0]!,
    (cell) => species.habitat.includes(cell) || (terrestrialPassable(cell) && habitatSuitability(species, state, cell) > 0.15),
    400,
  );
  if (!reachable.includes(bestCell)) return;

  species.habitat.push(bestCell);
  emit({
    type: "SPECIES_MIGRATED",
    cell: bestCell,
    causeIds: [],
    cause: `population pressure (${Math.round(species.population)} vs capacity ${Math.round(capacity)})`,
    actors: [{ kind: "species", id: species.id, name: species.name }],
    data: { habitatSize: species.habitat.length },
    importance: 0.35,
    originContributionId: species.originContributionId,
  });
}

function maybeMutate(ctx: SystemCtx, species: Species): void {
  const { state, rng, emit } = ctx;
  const p = species.traits.mutationRate * 0.008 * (1 + species.population / 5000);
  if (!rng.chance(Math.min(0.05, p))) return;
  const drift = (): number => rng.range(-0.12, 0.12);
  const child: Species = {
    id: nextEntityId(state, "sp"),
    name: generateName(rng, 2),
    diet: species.diet,
    traits: {
      ...species.traits,
      size: clamp01(species.traits.size + drift()),
      reproductionRate: clamp01(species.traits.reproductionRate + drift()),
      heatResistance: clamp01(species.traits.heatResistance + drift()),
      coldResistance: clamp01(species.traits.coldResistance + drift()),
      adaptability: clamp01(species.traits.adaptability + drift()),
      mutationRate: clamp01(species.traits.mutationRate + drift() * 0.5),
    },
    preyIds: [...species.preyIds],
    population: Math.round(species.population * 0.15),
    habitat: [...species.habitat.slice(0, 2)],
    originCell: species.originCell,
    bornAtTick: state.tick,
    extinctAtTick: null,
    parentSpeciesId: species.id,
    originContributionId: species.originContributionId,
  };
  species.population = Math.round(species.population * 0.85);
  state.species.push(child);
  emit({
    type: "SPECIES_MUTATED",
    cell: species.originCell,
    causeIds: [],
    cause: `genetic drift in ${species.name} produced a viable subspecies`,
    actors: [
      { kind: "species", id: species.id, name: species.name },
      { kind: "species", id: child.id, name: child.name },
    ],
    data: { parentSpeciesId: species.id },
    importance: 0.45,
    originContributionId: species.originContributionId,
  });
}
