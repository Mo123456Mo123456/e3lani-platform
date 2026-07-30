/**
 * Genesis seeding: the initial biosphere (plants + creatures), founding
 * civilizations and the seeded technology registry. All emitted as events so
 * the journal explains the world from its first tick.
 */
import type { Biome, Civilization, Plant, Species, Technology } from "@planet/shared-types";
import { generateCultureValues, generateName, generateTechName } from "../names";
import type { Rng } from "../rng";
import { BIOME_HABITABLE } from "../worldgen/biomes";
import type { EmitInput } from "./engine";
import { nextEntityId, type WorldState } from "./state";

type Emit = (input: EmitInput) => { id: string };

export function genesisTechnology(state: WorldState, rng: Rng, total = 50): void {
  for (let tier = 0; tier < total; tier++) {
    state.techs.push({
      id: `tech-${tier}`,
      name: generateTechName(rng, tier),
      tier,
      effects: {
        farming: Math.min(2, 1 + tier * 0.04),
        medicine: Math.min(2, 1 + tier * 0.035),
        industry: Math.min(2.5, 1 + tier * 0.05),
        military: Math.min(2.5, 1 + tier * 0.05),
      },
    } satisfies Technology);
  }
}

const GENESIS_PLANTS: Array<{ biomes: Biome[]; waterNeed: number }> = [
  { biomes: ["rainforest"], waterNeed: 0.8 },
  { biomes: ["temperate_forest"], waterNeed: 0.6 },
  { biomes: ["plains", "steppe"], waterNeed: 0.4 },
  { biomes: ["swamp"], waterNeed: 0.9 },
  { biomes: ["tundra"], waterNeed: 0.3 },
  { biomes: ["desert"], waterNeed: 0.15 },
];

export interface BiosphereCounts {
  speciesCount: number;
  plantCount: number;
}

export function genesisBiosphere(state: WorldState, rng: Rng, emit: Emit, counts: BiosphereCounts = { speciesCount: 8, plantCount: 6 }): void {
  const { grid } = state;

  // --- plants: archetype instances per biome family --------------------------
  const plantTotal = Math.max(counts.plantCount, GENESIS_PLANTS.length);
  for (let i = 0; i < plantTotal; i++) {
    const proto = GENESIS_PLANTS[i % GENESIS_PLANTS.length]!;
    let suitable = grid.cells.filter(
      (c) => proto.biomes.includes(c.biome) && c.moisture >= proto.waterNeed * 0.5,
    );
    if (suitable.length === 0) {
      // fallback: any moist land keeps the archetype alive at low coverage
      suitable = grid.cells.filter((c) => c.height >= grid.seaLevel && c.moisture > 0.35);
    }
    if (suitable.length === 0) continue;
    const plant: Plant = {
      id: nextEntityId(state, "plant"),
      name: generateName(rng, 2),
      traits: {
        size: rng.range(0.2, 0.7),
        growthRate: rng.range(0.3, 0.6),
        waterNeed: proto.waterNeed,
        pollutionAbsorption: rng.range(0.2, 0.5),
        nightLuminosity: 0,
        coldResistance: rng.range(0.2, 0.8),
        heatResistance: rng.range(0.2, 0.8),
        energyStorage: rng.range(0.05, 0.3),
      },
      suitableBiomes: proto.biomes,
      coverage: {},
      bornAtTick: 0,
      originContributionId: null,
    };
    const seeds = rng.shuffled(suitable).slice(0, 4);
    for (const cell of seeds) plant.coverage[cell.index] = 0.5;
    state.plants.push(plant);
    if (i < GENESIS_PLANTS.length) {
      emit({
        type: "PLANT_SPREAD",
        cell: seeds[0]!.index,
        causeIds: [],
        cause: "genesis vegetation established",
        actors: [{ kind: "plant", id: plant.id, name: plant.name }],
        data: { archetype: proto.biomes[0]! },
        importance: 0.3,
      });
    }
  }

  // --- herbivores then predators -------------------------------------------
  const habitableLand = grid.cells.filter((c) => c.height >= grid.seaLevel && BIOME_HABITABLE[c.biome]);
  const herbivores: Species[] = [];
  const herbivoreCount = Math.max(1, Math.round(counts.speciesCount * 0.75));
  const predatorCount = Math.max(0, counts.speciesCount - herbivoreCount);
  for (let i = 0; i < herbivoreCount && habitableLand.length > 0; i++) {
    const origin = rng.pick(habitableLand);
    const species: Species = {
      id: nextEntityId(state, "sp"),
      name: generateName(rng, 2),
      diet: "herbivore",
      traits: {
        size: rng.range(0.2, 0.6),
        lifespan: rng.range(0.3, 0.7),
        reproductionRate: rng.range(0.35, 0.65),
        heatResistance: rng.range(0.2, 0.8),
        coldResistance: rng.range(0.2, 0.8),
        waterNeed: rng.range(0.3, 0.7),
        intelligence: rng.range(0.05, 0.25),
        aggression: rng.range(0.05, 0.3),
        mobility: rng.range(0.3, 0.7),
        adaptability: rng.range(0.3, 0.7),
        mutationRate: rng.range(0.1, 0.4),
      },
      preyIds: [],
      population: Math.round(rng.range(400, 1200)),
      habitat: [origin.index],
      originCell: origin.index,
      bornAtTick: 0,
      extinctAtTick: null,
      parentSpeciesId: null,
      originContributionId: null,
    };
    state.species.push(species);
    herbivores.push(species);
    if (i < 8) {
      emit({
        type: "SPECIES_CREATED",
        cell: origin.index,
        causeIds: [],
        cause: "genesis species emerged",
        actors: [{ kind: "species", id: species.id, name: species.name }],
        data: { diet: species.diet },
        importance: 0.35,
      });
    }
  }
  for (let i = 0; i < predatorCount && herbivores.length > 0; i++) {
    const prey = rng.pick(herbivores);
    const origin = prey.originCell;
    const predator: Species = {
      id: nextEntityId(state, "sp"),
      name: generateName(rng, 3),
      diet: "carnivore",
      traits: {
        size: rng.range(0.3, 0.7),
        lifespan: rng.range(0.3, 0.6),
        reproductionRate: rng.range(0.2, 0.4),
        heatResistance: rng.range(0.2, 0.8),
        coldResistance: rng.range(0.2, 0.8),
        waterNeed: rng.range(0.3, 0.6),
        intelligence: rng.range(0.15, 0.4),
        aggression: rng.range(0.6, 0.9),
        mobility: rng.range(0.5, 0.8),
        adaptability: rng.range(0.3, 0.6),
        mutationRate: rng.range(0.1, 0.3),
      },
      preyIds: [prey.id],
      population: Math.round(rng.range(80, 240)),
      habitat: [origin],
      originCell: origin,
      bornAtTick: 0,
      extinctAtTick: null,
      parentSpeciesId: null,
      originContributionId: null,
    };
    state.species.push(predator);
    if (i < 4) {
      emit({
        type: "SPECIES_CREATED",
        cell: origin,
        causeIds: [],
        cause: `predator emerged preying on ${prey.name}`,
        actors: [
          { kind: "species", id: predator.id, name: predator.name },
          { kind: "species", id: prey.id, name: prey.name },
        ],
        data: { diet: "carnivore" },
        importance: 0.4,
      });
    }
  }
}

export function genesisCivilizations(
  state: WorldState,
  rng: Rng,
  emit: Emit,
  count: number,
): void {
  const { grid } = state;
  const candidates = grid.cells.filter(
    (c) =>
      c.height >= grid.seaLevel &&
      BIOME_HABITABLE[c.biome] &&
      c.fertility > 0.35 &&
      !c.ownerId,
  );
  const chosen: number[] = [];
  for (let i = 0; i < count && candidates.length > 0; i++) {
    // spread founders apart: pick the candidate farthest from chosen ones
    let best: (typeof candidates)[number] | null = null;
    let bestScore = -1;
    for (const c of rng.shuffled(candidates).slice(0, 40)) {
      const minDist = chosen.length === 0 ? 999 : Math.min(
        ...chosen.map((idx) => {
          const o = grid.cells[idx]!;
          return Math.hypot(c.lat - o.lat, c.lon - o.lon);
        }),
      );
      const score = minDist + c.fertility * 20;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    foundCivilization(state, rng, emit, best.index, null);
    chosen.push(best.index);
  }
}

export function foundCivilization(
  state: WorldState,
  rng: Rng,
  emit: Emit,
  cell: number,
  originContributionId: string | null,
): string {
  const grid = state.grid;
  const culture = {
    id: nextEntityId(state, "culture"),
    name: generateName(rng, 2),
    values: generateCultureValues(rng),
  };
  const language = {
    id: nextEntityId(state, "lang"),
    name: generateName(rng, 2),
    family: generateName(rng, 1),
  };
  state.cultures.push(culture);
  state.languages.push(language);

  const civId = nextEntityId(state, "civ");
  const civ: Civilization = {
    id: civId,
    name: generateName(rng, 2),
    color: CIV_COLORS[state.civs.length % CIV_COLORS.length] ?? "#c9a227",
    population: Math.round(rng.range(300, 900)),
    cityIds: [] as string[],
    cultureId: culture.id,
    languageId: language.id,
    government: "tribal" as const,
    techLevel: 0,
    discoveredTechIds: [] as string[],
    military: rng.range(0.15, 0.4),
    food: rng.range(200, 600),
    economy: rng.range(0.1, 0.3),
    health: 0.55,
    stability: rng.range(0.5, 0.8),
    education: rng.range(0.1, 0.3),
    happiness: rng.range(0.4, 0.7),
    pollution: 0,
    aggression: rng.range(0.2, 0.85),
    innovation: rng.range(0.2, 0.7),
    relations: {},
    memory: {},
    foundedAtTick: state.tick,
    collapsedAtTick: null,
    originContributionId,
  };
  // seed initial diplomatic dispositions so trade and rivalry can emerge
  for (const other of state.civs) {
    const disposition = rng.range(-0.15, 0.35);
    civ.relations[other.id] = Math.round(disposition * 100) / 100;
    other.relations[civId] = Math.round((disposition + rng.range(-0.1, 0.1)) * 100) / 100;
  }
  state.civs.push(civ);

  // claim a small starting territory
  grid.cells[cell]!.ownerId = civId;
  for (const n of grid.neighbors[cell]!) {
    const neighbor = grid.cells[n]!;
    if (!neighbor.ownerId && neighbor.height >= grid.seaLevel && rng.chance(0.6)) {
      neighbor.ownerId = civId;
    }
  }

  const cityId = nextEntityId(state, "city");
  const city = {
    id: cityId,
    name: generateName(rng, 2),
    civId,
    cell,
    population: Math.round(civ.population * 0.6),
    foundedAtTick: state.tick,
    destroyedAtTick: null,
  };
  state.cities.push(city);
  civ.cityIds.push(cityId);

  emit({
    type: "CIVILIZATION_FOUNDED",
    cell,
    causeIds: [],
    cause: originContributionId
      ? "civilization seeded by a user contribution"
      : "nomadic tribes settled fertile land",
    actors: [{ kind: "civilization", id: civId, name: civ.name }],
    data: { government: civ.government },
    importance: 0.7,
    originContributionId,
  });
  return civId;
}

const CIV_COLORS = [
  "#c9a227", "#3f8efc", "#e15554", "#7d5ba6", "#3bb273", "#e8871e",
  "#4d908e", "#f3722c", "#90be6d", "#577590", "#f9c74f", "#f94144",
];
