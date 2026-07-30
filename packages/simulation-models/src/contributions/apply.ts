/**
 * Applying a validated user contribution to the world.
 *
 * The contribution becomes a real entity (plant, species, deposit, civ,
 * tech, disease, phenomenon shock) at the chosen origin cell. From there the
 * regular systems propagate its consequences — the engine, not the AI
 * narrator, decides what actually happens.
 */
import type {
  Biome,
  Contribution,
  Plant,
  ResourceType,
  Species,
  StructuredContribution,
  WorldEvent,
} from "@planet/shared-types";
import { clamp01 } from "../noise";
import { foundCivilization } from "../engine/genesis";
import { nextEntityId, type WorldState } from "../engine/state";
import type { EmitInput } from "../engine/engine";
import { rngFromString, type Rng } from "../rng";
import { SimulationEngine } from "../engine/engine";
import { plantSuitability } from "../engine/systems/ecosystem";

type Emit = (input: EmitInput) => WorldEvent;

export function applyContribution(
  state: WorldState,
  contribution: Contribution,
  rng: Rng,
  emit: Emit,
): WorldEvent {
  const structured = contribution.structured;
  const placement = emit({
    type: "CONTRIBUTION_PLACED",
    cell: contribution.originCell,
    causeIds: [],
    cause: `user contribution "${structured.name}" entered the world`,
    actors: [{ kind: "contribution", id: contribution.id, name: structured.name }],
    data: { category: structured.category },
    importance: 0.7,
    originUserId: contribution.userId,
    originContributionId: contribution.id,
  });

  switch (structured.category) {
    case "plant":
      placePlant(state, contribution, rng, emit, placement.id);
      break;
    case "creature":
      placeCreature(state, contribution, rng, emit, placement.id);
      break;
    case "resource":
      placeResource(state, contribution, rng, emit, placement.id);
      break;
    case "civilization":
      foundCivilization(state, rng, emit, contribution.originCell, contribution.id);
      break;
    case "invention":
      placeInvention(state, contribution, rng, emit, placement.id);
      break;
    case "disease":
      placeDisease(state, contribution, rng, emit, placement.id);
      break;
    case "phenomenon":
      placePhenomenon(state, contribution, rng, emit, placement.id);
      break;
    case "culture":
    case "law":
    case "custom":
      placeCulturalShift(state, contribution, emit, placement.id);
      break;
  }
  contribution.status = "placed";
  contribution.createdAtTick = state.tick;
  state.contributions.push(contribution);
  return placement;
}

// ---------------------------------------------------------------------------

function placePlant(state: WorldState, contribution: Contribution, rng: Rng, emit: Emit, causeId: string): void {
  const t = contribution.structured.traits;
  const plant: Plant = {
    id: nextEntityId(state, "plant"),
    name: contribution.structured.name,
    traits: {
      size: t.size ?? 0.5,
      growthRate: t.growthRate ?? 0.4,
      waterNeed: t.waterNeed ?? 0.5,
      pollutionAbsorption: t.pollutionAbsorption ?? 0.3,
      nightLuminosity: t.nightLuminosity ?? 0,
      coldResistance: t.coldResistance ?? 0.4,
      heatResistance: t.heatResistance ?? 0.4,
      energyStorage: t.energyStorage ?? 0.1,
      toxicity: t.toxicity ?? 0,
    },
    suitableBiomes: contribution.structured.possibleBiomes.length > 0
      ? contribution.structured.possibleBiomes
      : (["plains", "temperate_forest"] as Biome[]),
    coverage: {},
    bornAtTick: state.tick,
    originContributionId: contribution.id,
  };
  // seed coverage where the plant can actually live
  const origin = contribution.originCell;
  const options = [origin, ...state.grid.neighbors[origin]!].filter(
    (c) => plantSuitability(plant, state, c) > 0.2,
  );
  if (options.length === 0) options.push(origin);
  for (const cell of options.slice(0, 4)) plant.coverage[cell] = 0.4;
  state.plants.push(plant);
  emit({
    type: "PLANT_SPREAD",
    cell: origin,
    causeIds: [causeId],
    cause: `the contributed plant ${plant.name} took root`,
    actors: [{ kind: "plant", id: plant.id, name: plant.name }],
    data: { cells: Object.keys(plant.coverage).length },
    importance: 0.5,
    originUserId: contribution.userId,
    originContributionId: contribution.id,
  });
  void rng;
}

function placeCreature(state: WorldState, contribution: Contribution, rng: Rng, emit: Emit, causeId: string): void {
  const t = contribution.structured.traits;
  const diet = (t.photosynthetic ?? 0) > 0.6 ? "producer" : (t.aggression ?? 0.3) > 0.6 ? "carnivore" : "herbivore";
  const herbivores = state.species.filter((s) => s.diet === "herbivore" && !s.extinctAtTick);
  const species: Species = {
    id: nextEntityId(state, "sp"),
    name: contribution.structured.name,
    diet,
    traits: {
      size: t.size ?? 0.4,
      lifespan: t.lifespan ?? 0.5,
      reproductionRate: t.reproductionRate ?? 0.4,
      heatResistance: t.heatResistance ?? 0.4,
      coldResistance: t.coldResistance ?? 0.4,
      waterNeed: t.waterNeed ?? 0.5,
      intelligence: t.intelligence ?? 0.2,
      aggression: t.aggression ?? 0.3,
      mobility: t.mobility ?? 0.4,
      adaptability: t.adaptability ?? 0.4,
      mutationRate: t.mutationRate ?? 0.2,
      photosynthetic: (t.photosynthetic ?? 0) > 0.6,
      aquatic: contribution.structured.possibleBiomes.includes("ocean"),
    },
    preyIds: diet === "carnivore" && herbivores.length > 0 ? [rng.pick(herbivores).id] : [],
    population: Math.round(120 + (t.reproductionRate ?? 0.4) * 300),
    habitat: [contribution.originCell],
    originCell: contribution.originCell,
    bornAtTick: state.tick,
    extinctAtTick: null,
    parentSpeciesId: null,
    originContributionId: contribution.id,
  };
  state.species.push(species);
  emit({
    type: "SPECIES_CREATED",
    cell: contribution.originCell,
    causeIds: [causeId],
    cause: `the contributed creature ${species.name} appeared`,
    actors: [{ kind: "species", id: species.id, name: species.name }],
    data: { diet: species.diet, population: species.population },
    importance: 0.55,
    originUserId: contribution.userId,
    originContributionId: contribution.id,
  });
}

function placeResource(state: WorldState, contribution: Contribution, rng: Rng, emit: Emit, causeId: string): void {
  const t = contribution.structured.traits;
  const cell = state.grid.cells[contribution.originCell]!;
  const type = pickResourceType(contribution.structured, rng);
  const deposit = {
    id: `res-${cell.index}-contrib-${contribution.id.slice(0, 8)}`,
    type,
    quantity: Math.round(150 + (t.yield ?? 0.5) * 500),
    renewRate: (t.renewability ?? 0) * 0.08,
    value: clamp01(0.3 + (t.value ?? 0.5) * 0.7),
    discovered: true,
  };
  cell.resources.push(deposit);
  emit({
    type: "RESOURCE_DISCOVERED",
    cell: cell.index,
    causeIds: [causeId],
    cause: `the contributed resource appeared and was immediately charted`,
    actors: [{ kind: "contribution", id: contribution.id, name: contribution.structured.name }],
    data: { resource: deposit.type, quantity: deposit.quantity },
    importance: 0.55,
    originUserId: contribution.userId,
    originContributionId: contribution.id,
  });
}

function pickResourceType(structured: StructuredContribution, rng: Rng): ResourceType {
  const text = `${structured.name} ${structured.description}`.toLowerCase();
  const table: Array<[RegExp, ResourceType]> = [
    [/gold|ذهب/, "gold"],
    [/iron|حديد/, "iron"],
    [/copper|نحاس/, "copper"],
    [/oil|نفط|بترول/, "oil"],
    [/coal|فحم/, "coal"],
    [/uranium|يورانيوم/, "uranium"],
    [/crystal|كريستال|بلور/, "crystal"],
    [/water|ماء|مياه/, "fresh_water"],
    [/fish|سمك|أسماك/, "fish"],
    [/grain|قمح|حبوب/, "grain"],
    [/wood|timber|خشب/, "timber"],
  ];
  for (const [pattern, type] of table) if (pattern.test(text)) return type;
  return rng.pick(["iron", "copper", "crystal", "grain", "timber"] as const);
}

function placeInvention(state: WorldState, contribution: Contribution, rng: Rng, emit: Emit, causeId: string): void {
  const cell = contribution.originCell;
  const ownerId = state.grid.cells[cell]!.ownerId;
  const civ = state.civs.find((c) => c.id === ownerId) ??
    state.civs.filter((c) => !c.collapsedAtTick).sort(
      (a, b) =>
        nearestCityDistance(state, a, cell) - nearestCityDistance(state, b, cell),
    )[0];
  const t = contribution.structured.traits;
  const tech = {
    id: nextEntityId(state, "tech"),
    name: contribution.structured.name,
    tier: state.techs.length,
    effects: {
      farming: 1 + (t.yield ?? 0.2),
      medicine: 1 + (t.medicine ?? t.health ?? 0.15),
      industry: 1 + (t.efficiency ?? t.energyStorage ?? 0.25),
      military: 1 + (t.military ?? 0.05),
    },
  };
  state.techs.push(tech);
  if (civ) {
    civ.discoveredTechIds.push(tech.id);
    civ.innovation = clamp01(civ.innovation + 0.05);
  }
  emit({
    type: "TECHNOLOGY_DISCOVERED",
    cell,
    causeIds: [causeId],
    cause: civ
      ? `${civ.name} adopted the contributed invention`
      : "the contributed invention spread without a sponsor",
    actors: civ ? [{ kind: "civilization", id: civ.id, name: civ.name }] : [],
    data: { technology: tech.name },
    importance: 0.6,
    originUserId: contribution.userId,
    originContributionId: contribution.id,
  });
  void rng;
}

function nearestCityDistance(state: WorldState, civ: { cityIds: string[] }, cell: number): number {
  const target = state.grid.cells[cell]!;
  let best = Infinity;
  for (const cityId of civ.cityIds) {
    const city = state.cities.find((c) => c.id === cityId);
    if (!city || city.destroyedAtTick) continue;
    const c = state.grid.cells[city.cell]!;
    best = Math.min(best, Math.hypot(c.lat - target.lat, c.lon - target.lon));
  }
  return best;
}

function placeDisease(state: WorldState, contribution: Contribution, rng: Rng, emit: Emit, causeId: string): void {
  const t = contribution.structured.traits;
  state.diseases.push({
    id: nextEntityId(state, "disease"),
    name: contribution.structured.name,
    severity: t.severity ?? 0.4,
    contagiousness: t.contagiousness ?? 0.4,
    originCell: contribution.originCell,
    affectedCivIds: [],
    startedAtTick: state.tick,
    endedAtTick: null,
  });
  emit({
    type: "DISEASE_OUTBREAK",
    cell: contribution.originCell,
    causeIds: [causeId],
    cause: `the contributed pathogen ${contribution.structured.name} surfaced`,
    actors: [{ kind: "contribution", id: contribution.id, name: contribution.structured.name }],
    data: { severity: t.severity ?? 0.4 },
    importance: 0.65,
    originUserId: contribution.userId,
    originContributionId: contribution.id,
  });
  void rng;
}

function placePhenomenon(state: WorldState, contribution: Contribution, rng: Rng, emit: Emit, causeId: string): void {
  const t = contribution.structured.traits;
  const cell = contribution.originCell;
  const volcanic = (t.seismic ?? 0) > 0.5;
  if (volcanic) {
    state.grid.cells[cell]!.volcanic = true;
    state.climate.volcanicForcing = clamp01(state.climate.volcanicForcing + 0.04);
    emit({
      type: "VOLCANO_ERUPTED",
      cell,
      causeIds: [causeId],
      cause: `the contributed phenomenon ${contribution.structured.name} ruptured the crust`,
      actors: [{ kind: "contribution", id: contribution.id, name: contribution.structured.name }],
      data: {},
      importance: 0.75,
      originUserId: contribution.userId,
      originContributionId: contribution.id,
    });
  } else {
    for (const idx of [cell, ...state.grid.neighbors[cell]!]) {
      const c = state.grid.cells[idx]!;
      c.moisture = clamp01(c.moisture + (t.wetness ?? 0.2) - (t.dryness ?? 0));
      c.temperature = clamp01(c.temperature + (t.warming ?? 0) - (t.cooling ?? 0));
    }
    emit({
      type: "CLIMATE_CHANGED",
      cell,
      causeIds: [causeId],
      cause: `the contributed phenomenon ${contribution.structured.name} shifted the local climate`,
      actors: [{ kind: "contribution", id: contribution.id, name: contribution.structured.name }],
      data: {},
      importance: 0.6,
      originUserId: contribution.userId,
      originContributionId: contribution.id,
    });
  }
  void rng;
}

function placeCulturalShift(state: WorldState, contribution: Contribution, emit: Emit, causeId: string): void {
  const cell = contribution.originCell;
  const civ = state.civs.find((c) => c.id === state.grid.cells[cell]!.ownerId);
  if (civ) {
    civ.happiness = clamp01(civ.happiness + 0.05);
    civ.education = clamp01(civ.education + 0.03);
    civ.stability = clamp01(civ.stability + 0.03);
  }
  emit({
    type: "GOVERNMENT_CHANGED",
    cell,
    causeIds: [causeId],
    cause: `the contributed idea "${contribution.structured.name}" reshaped local culture`,
    actors: civ ? [{ kind: "civilization", id: civ.id, name: civ.name }] : [],
    data: { category: contribution.structured.category },
    importance: 0.45,
    originUserId: contribution.userId,
    originContributionId: contribution.id,
  });
}

// ---------------------------------------------------------------------------
// Preview: apply on a throwaway branch and report what the engine predicts
// ---------------------------------------------------------------------------

export function previewContribution(
  engine: SimulationEngine,
  contribution: Contribution,
  horizonTicks = 40,
): { events: WorldEvent[]; survivalScore: number } {
  const snapshot = engine.getSnapshot(engine.state.tick);
  if (!snapshot) return { events: [], survivalScore: 0 };
  const branch = SimulationEngine.fromSnapshot(engine.config, snapshot, []);
  const rng = rngFromString(`${contribution.id}:preview`);
  const emit = branch.makeEmitter();
  const cloned: Contribution = { ...contribution, structured: structuredClone(contribution.structured) };
  applyContribution(branch.state, cloned, rng, emit);
  const events = branch.run(horizonTicks).filter(
    (e) => e.originContributionId === contribution.id,
  );
  return { events, survivalScore: contributionViability(branch.state, contribution.id) };
}

/** 0..1 — is the contributed entity alive and spreading in this branch? */
export function contributionViability(state: WorldState, contributionId: string): number {
  const plant = state.plants.find((p) => p.originContributionId === contributionId);
  if (plant) return clamp01(Object.keys(plant.coverage).length / 8);
  const species = state.species.find((s) => s.originContributionId === contributionId);
  if (species) {
    if (species.extinctAtTick) return 0.05;
    return clamp01(species.population / 800);
  }
  const civ = state.civs.find((c) => c.originContributionId === contributionId);
  if (civ) return civ.collapsedAtTick ? 0.1 : clamp01(civ.population / 2000 + 0.3);
  return 0.5;
}
