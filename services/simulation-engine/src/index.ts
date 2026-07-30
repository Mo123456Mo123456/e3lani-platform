import type {
  AnalyzedContribution,
  CausalLink,
  ContributionPreview,
  RegionSummary,
  ScenarioOutcome,
  WorldEvent,
  WorldEventType,
  WorldMetrics,
} from "@living-planet/shared-types";
import { climateStep, logisticPopulationStep } from "@living-planet/simulation-models";
import { createSeededRandom, generatePlanet, hashSeed, type GeneratedRegion } from "@living-planet/world-generator";

export interface SimulationRegion extends GeneratedRegion {
  population: number;
  pollution: number;
  biodiversity: number;
  economy: number;
  vegetation: number;
}

export interface SimulationSnapshot {
  tick: number;
  year: number;
  eventOffset: number;
  regions: Record<string, SimulationRegion>;
  checksum: string;
}

export interface SimulationState {
  planetId: string;
  seed: string;
  tick: number;
  year: number;
  sequence: number;
  regions: Record<string, SimulationRegion>;
  events: WorldEvent[];
  causalLinks: CausalLink[];
  snapshots: SimulationSnapshot[];
}

export interface TickResult {
  state: SimulationState;
  events: WorldEvent[];
  causalLinks: CausalLink[];
}

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

function copyRegions(regions: Record<string, SimulationRegion>): Record<string, SimulationRegion> {
  return Object.fromEntries(Object.entries(regions).map(([id, region]) => [id, { ...region }]));
}

function stateChecksum(state: Pick<SimulationState, "tick" | "year" | "regions">): string {
  const serialized = Object.values(state.regions)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((region) => `${region.id}:${region.population}:${region.pollution}:${region.temperature}:${region.moisture}`)
    .join("|");
  return hashSeed(`${state.tick}:${state.year}:${serialized}`).toString(16).padStart(8, "0");
}

export function createInitialState(seed: string, planetId = "00000000-0000-4000-8000-000000000001"): SimulationState {
  const generated = generatePlanet(seed, 12, 24);
  const regions = Object.fromEntries(
    generated.regions.map((region) => {
      const habitability = region.biome === "ocean" || region.biome === "ice" ? 0.01 : region.fertility;
      const population = Math.round(region.carryingCapacity * habitability * 0.18);
      return [
        region.id,
        {
          ...region,
          population,
          pollution: 0.015,
          biodiversity: round(Math.max(0.05, region.fertility * 0.85 + region.moisture * 0.15)),
          economy: round(population * (0.1 + region.resourceRichness)),
          vegetation: round(region.biome === "ocean" || region.biome === "ice" ? 0.03 : region.fertility),
        },
      ];
    }),
  );

  return {
    planetId,
    seed,
    tick: 0,
    year: 0,
    sequence: 0,
    regions,
    events: [],
    causalLinks: [],
    snapshots: [],
  };
}

interface EventInput {
  type: WorldEventType;
  title: string;
  summary: string;
  region: SimulationRegion;
  cause: string;
  importance: number;
  confidence: number;
  directEffects: Record<string, number>;
  contributionId?: string;
}

function createEvent(state: SimulationState, input: EventInput, sequence: number): WorldEvent {
  const identity = hashSeed(
    `${state.seed}:${state.tick}:${sequence}:${input.type}:${input.region.id}:${input.contributionId ?? ""}`,
  )
    .toString(16)
    .padStart(8, "0");
  return {
    id: `evt-${state.tick.toString().padStart(8, "0")}-${sequence.toString().padStart(4, "0")}-${identity}`,
    planetId: state.planetId,
    tick: state.tick,
    year: state.year,
    type: input.type,
    title: input.title,
    summary: input.summary,
    regionId: input.region.id,
    coordinates: {
      latitude: input.region.latitude,
      longitude: input.region.longitude,
    },
    importance: round(Math.max(0, Math.min(1, input.importance))),
    confidence: round(Math.max(0, Math.min(1, input.confidence))),
    cause: input.cause,
    directEffects: input.directEffects,
    contributionId: input.contributionId ?? null,
    createdAt: new Date(Date.UTC(2000 + state.year, 0, 1)).toISOString(),
  };
}

export function applyEvent(state: SimulationState, event: WorldEvent): SimulationState {
  if (!event.cause.trim()) throw new Error(`Event ${event.id} has no cause`);
  const region = state.regions[event.regionId];
  if (!region) throw new Error(`Event ${event.id} targets unknown region ${event.regionId}`);
  const nextRegion = { ...region };
  for (const [property, delta] of Object.entries(event.directEffects)) {
    if (!Number.isFinite(delta)) throw new Error(`Event ${event.id} has a non-finite effect`);
    switch (property) {
      case "population":
        nextRegion.population = Math.max(0, Math.min(nextRegion.carryingCapacity, Math.round(nextRegion.population + delta)));
        break;
      case "pollution":
        nextRegion.pollution = round(Math.max(0, Math.min(1, nextRegion.pollution + delta)));
        break;
      case "temperature":
        nextRegion.temperature = round(Math.max(0, Math.min(1, nextRegion.temperature + delta)));
        break;
      case "moisture":
        nextRegion.moisture = round(Math.max(0, Math.min(1, nextRegion.moisture + delta)));
        break;
      case "biodiversity":
        nextRegion.biodiversity = round(Math.max(0, Math.min(1, nextRegion.biodiversity + delta)));
        break;
      case "economy":
        nextRegion.economy = round(Math.max(0, nextRegion.economy + delta));
        break;
      case "vegetation":
        nextRegion.vegetation = round(Math.max(0, Math.min(1, nextRegion.vegetation + delta)));
        break;
      default:
        throw new Error(`Unsupported event effect: ${property}`);
    }
  }
  return {
    ...state,
    tick: Math.max(state.tick, event.tick),
    year: Math.max(state.year, event.year),
    sequence: state.sequence + 1,
    regions: { ...state.regions, [event.regionId]: nextRegion },
    events: [...state.events, event],
  };
}

function neighborRegions(state: SimulationState, region: SimulationRegion): SimulationRegion[] {
  return Object.values(state.regions).filter((candidate) => {
    const latitudeDistance = Math.abs(candidate.latitude - region.latitude);
    const rawLongitudeDistance = Math.abs(candidate.longitude - region.longitude);
    const longitudeDistance = Math.min(rawLongitudeDistance, 360 - rawLongitudeDistance);
    return candidate.id !== region.id && latitudeDistance <= 16 && longitudeDistance <= 16;
  });
}

export function runTick(input: SimulationState): TickResult {
  const tickState: SimulationState = { ...input, tick: input.tick + 1, year: input.year + 1 };
  const generatedEvents: WorldEvent[] = [];
  const generatedLinks: CausalLink[] = [];
  let working = { ...tickState, regions: copyRegions(input.regions), events: [...input.events] };
  let sequence = input.sequence;
  const random = createSeededRandom(`${input.seed}:tick:${tickState.tick}`);

  for (const originalRegion of Object.values(input.regions).sort((left, right) => left.index - right.index)) {
    const neighbors = neighborRegions(input, originalRegion);
    const climate = climateStep(
      {
        temperature: originalRegion.temperature,
        moisture: originalRegion.moisture,
        vegetation: originalRegion.vegetation,
        pollution: originalRegion.pollution,
        volcanicActivity: originalRegion.plateActivity > 0.86 ? originalRegion.plateActivity * 0.03 : 0,
      },
      neighbors.map((neighbor) => ({
        temperature: neighbor.temperature,
        moisture: neighbor.moisture,
        vegetation: neighbor.vegetation,
        pollution: neighbor.pollution,
        volcanicActivity: 0,
      })),
      originalRegion.population * 0.000000002,
    );
    const nextPopulation = logisticPopulationStep({
      population: originalRegion.population,
      carryingCapacity: originalRegion.carryingCapacity,
      intrinsicGrowthRate: 0.018,
      foodSecurity: Math.min(1, originalRegion.fertility + originalRegion.moisture * 0.3),
      diseasePressure: originalRegion.pollution * 0.2,
      conflictPressure: 0,
    });
    const effects = {
      population: nextPopulation - originalRegion.population,
      temperature: round(climate.temperature - originalRegion.temperature),
      moisture: round(climate.moisture - originalRegion.moisture),
      vegetation: round(climate.vegetation - originalRegion.vegetation),
      pollution: round(climate.pollution - originalRegion.pollution),
      biodiversity: round((climate.vegetation - originalRegion.vegetation) * 0.35 - climate.pollution * 0.002),
      economy: round((nextPopulation - originalRegion.population) * 0.12 + originalRegion.resourceRichness * 12),
    };
    sequence += 1;
    const climateEvent = createEvent(
      { ...working, tick: tickState.tick, year: tickState.year },
      {
        type: "CLIMATE_CHANGED",
        title: "Regional annual cycle",
        summary: `Climate and population advanced deterministically in ${originalRegion.name}.`,
        region: originalRegion,
        cause: "Annual energy balance, neighboring moisture diffusion, vegetation, emissions and carrying capacity",
        importance: Math.min(0.6, Math.abs(effects.temperature) * 20 + Math.abs(effects.population) / 100_000),
        confidence: 0.94,
        directEffects: effects,
      },
      sequence,
    );
    working = applyEvent(working, climateEvent);
    generatedEvents.push(climateEvent);

    if (originalRegion.plateActivity > 0.84 && random() < originalRegion.plateActivity * 0.018) {
      sequence += 1;
      const volcanoEvent = createEvent(
        { ...working, tick: tickState.tick, year: tickState.year },
        {
          type: "VOLCANO_ERUPTED",
          title: "Volcanic eruption",
          summary: `Plate stress released in ${originalRegion.name}, raising aerosols and damaging habitats.`,
          region: originalRegion,
          cause: `Plate activity ${originalRegion.plateActivity} crossed the seeded eruption threshold`,
          importance: 0.82,
          confidence: 0.87,
          directEffects: {
            population: -Math.round(originalRegion.population * 0.015),
            pollution: 0.08,
            temperature: -0.015,
            biodiversity: -0.045,
            economy: -originalRegion.economy * 0.025,
          },
        },
        sequence,
      );
      working = applyEvent(working, volcanoEvent);
      generatedEvents.push(volcanoEvent);
      generatedLinks.push({
        id: `cause-${climateEvent.id}-${volcanoEvent.id}`,
        sourceEventId: climateEvent.id,
        targetEventId: volcanoEvent.id,
        mechanism: "Accumulated plate activity and regional atmospheric conditions",
        strength: originalRegion.plateActivity,
      });
    }
  }

  working = {
    ...working,
    tick: tickState.tick,
    year: tickState.year,
    sequence,
    causalLinks: [...input.causalLinks, ...generatedLinks],
    snapshots: input.snapshots,
  };
  if (working.tick % 10 === 0) working = takeSnapshot(working);
  return { state: working, events: generatedEvents, causalLinks: generatedLinks };
}

export function takeSnapshot(state: SimulationState): SimulationState {
  const snapshot: SimulationSnapshot = {
    tick: state.tick,
    year: state.year,
    eventOffset: state.events.length,
    regions: copyRegions(state.regions),
    checksum: stateChecksum(state),
  };
  return { ...state, snapshots: [...state.snapshots.filter((item) => item.tick !== snapshot.tick), snapshot] };
}

export function rollbackToSnapshot(state: SimulationState, tick: number): SimulationState {
  const snapshot = [...state.snapshots]
    .filter((item) => item.tick <= tick)
    .sort((left, right) => right.tick - left.tick)[0];
  if (!snapshot) throw new Error(`No snapshot exists at or before tick ${tick}`);
  return {
    ...state,
    tick: snapshot.tick,
    year: snapshot.year,
    sequence: snapshot.eventOffset,
    regions: copyRegions(snapshot.regions),
    events: state.events.slice(0, snapshot.eventOffset),
    causalLinks: state.causalLinks.filter((link) =>
      state.events.slice(0, snapshot.eventOffset).some((event) => event.id === link.targetEventId),
    ),
    snapshots: state.snapshots.filter((item) => item.tick <= snapshot.tick),
  };
}

export function replayEvents(initialState: SimulationState, events: WorldEvent[]): SimulationState {
  const replayState: SimulationState = {
    ...initialState,
    events: [],
    causalLinks: [],
    snapshots: [],
  };
  return events.reduce<SimulationState>((state, event) => applyEvent(state, event), replayState);
}

function trait(contribution: AnalyzedContribution, key: string, fallback: number): number {
  const value = contribution.traits[key];
  return typeof value === "number" ? Math.max(0, Math.min(1, value)) : fallback;
}

function scenario(
  contribution: AnalyzedContribution,
  region: SimulationRegion,
  horizonYears: 1 | 10 | 100 | 1000,
  sampleSeed: string,
): ScenarioOutcome {
  const random = createSeededRandom(sampleSeed);
  const growth = trait(contribution, "growthRate", 0.35);
  const waterNeed = trait(contribution, "waterNeed", 0.35);
  const pollutionAbsorption = trait(contribution, "pollutionAbsorption", 0);
  const adaptability = trait(contribution, "adaptability", 0.45);
  const aggression = trait(contribution, "aggression", 0.1);
  const suitability =
    region.fertility * 0.3 +
    region.moisture * (0.35 - waterNeed * 0.18) +
    (1 - Math.abs(region.temperature - 0.58)) * 0.2 +
    adaptability * 0.15;
  const timeScale = Math.log10(horizonYears + 9);
  const uncertaintyNoise = (random() - 0.5) * Math.min(0.6, Math.log10(horizonYears + 1) * 0.16);
  const success = Math.max(0.02, Math.min(0.98, suitability + growth * 0.16 - aggression * 0.08 + uncertaintyNoise));
  const waterStress = Math.max(0, waterNeed * growth * timeScale - region.moisture * 0.25);
  const biodiversity = (success * adaptability - aggression * 0.7 - waterStress * 0.4) * timeScale * 0.12;
  const pollution = -pollutionAbsorption * success * timeScale * 0.1 + Math.max(0, aggression - 0.5) * 0.03;
  const population = Math.round(region.carryingCapacity * success * growth * timeScale * 0.012);
  const economy = (success * region.resourceRichness + pollutionAbsorption * 0.25 - waterStress * 0.3) * timeScale * 0.1;
  const eventType: WorldEventType =
    contribution.category === "plant" || contribution.category === "creature"
      ? "SPECIES_CREATED"
      : contribution.category === "civilization"
        ? "CIVILIZATION_FOUNDED"
        : contribution.category === "disease"
          ? "DISEASE_OUTBREAK"
          : contribution.category === "invention"
            ? "TECHNOLOGY_DISCOVERED"
            : "CONTRIBUTION_INTRODUCED";

  return {
    horizonYears,
    probability: round(success),
    confidence: round(Math.max(0.25, 0.94 - Math.log10(horizonYears + 1) * 0.14)),
    metrics: {
      populationDelta: population,
      biodiversityDelta: round(biodiversity),
      pollutionDelta: round(pollution),
      economicDelta: round(economy),
      waterStressDelta: round(waterStress),
    },
    events: [
      {
        type: eventType,
        year: horizonYears,
        probability: round(success),
        reason: `Habitat suitability ${round(suitability)} and deterministic growth-water balance`,
      },
    ],
  };
}

export function previewContribution(
  state: SimulationState,
  contribution: AnalyzedContribution,
  regionId: string,
  samples = 64,
): ContributionPreview {
  const region = state.regions[regionId];
  if (!region) throw new Error(`Unknown target region ${regionId}`);
  const runs = Array.from({ length: samples }, (_, index) =>
    scenario(contribution, region, 1000, `${state.seed}:${regionId}:${contribution.name}:${index}`),
  ).sort((left, right) => left.probability - right.probability);
  const bestCase = runs.at(-1) as ScenarioOutcome;
  const worstCase = runs[0] as ScenarioOutcome;
  const possibleBiomeBonus = contribution.possibleBiomes.includes(region.biome) ? 0.2 : -0.08;
  const suitability = Math.max(
    0,
    Math.min(1, region.fertility * 0.35 + region.moisture * 0.25 + (1 - region.pollution) * 0.2 + possibleBiomeBonus),
  );
  const meanProbability = runs.reduce((total, run) => total + run.probability, 0) / runs.length;
  const variance = runs.reduce((total, run) => total + (run.probability - meanProbability) ** 2, 0) / runs.length;

  return {
    contribution,
    region: toRegionSummary(region),
    suitability: round(suitability),
    successProbability: round(meanProbability),
    uncertainty: round(Math.sqrt(variance)),
    shortTerm: scenario(contribution, region, 10, `${state.seed}:${regionId}:short`),
    longTerm: scenario(contribution, region, 1000, `${state.seed}:${regionId}:long`),
    bestCase,
    worstCase,
    causalFactors: [
      { factor: "habitat_suitability", direction: "positive", weight: round(suitability) },
      { factor: "water_demand", direction: "negative", weight: trait(contribution, "waterNeed", 0.35) },
      { factor: "adaptability", direction: "positive", weight: trait(contribution, "adaptability", 0.45) },
      { factor: "pollution_pressure", direction: "negative", weight: region.pollution },
    ],
  };
}

export function introduceContribution(
  input: SimulationState,
  contribution: AnalyzedContribution,
  regionId: string,
  contributionId: string,
): TickResult {
  const region = input.regions[regionId];
  if (!region) throw new Error(`Unknown target region ${regionId}`);
  const preview = previewContribution(input, contribution, regionId, 32);
  const absorption = trait(contribution, "pollutionAbsorption", 0);
  const waterNeed = trait(contribution, "waterNeed", 0.35);
  const adaptability = trait(contribution, "adaptability", 0.45);
  const event = createEvent(
    input,
    {
      type: "CONTRIBUTION_INTRODUCED",
      title: contribution.name,
      summary: contribution.description,
      region,
      cause: `User contribution passed schema, moderation and balance checks; habitat suitability ${preview.suitability}`,
      importance: Math.max(0.35, preview.successProbability),
      confidence: 1 - preview.uncertainty,
      contributionId,
      directEffects: {
        pollution: -absorption * 0.025,
        moisture: -waterNeed * 0.012,
        biodiversity: adaptability * 0.018 - waterNeed * 0.006,
        economy: preview.shortTerm.metrics.economicDelta * 100,
      },
    },
    input.sequence + 1,
  );
  const state = applyEvent(input, event);
  return { state, events: [event], causalLinks: [] };
}

export function toRegionSummary(region: SimulationRegion): RegionSummary {
  return {
    id: region.id,
    name: region.name,
    latitude: region.latitude,
    longitude: region.longitude,
    biome: region.biome,
    elevation: region.elevation,
    temperature: region.temperature,
    moisture: region.moisture,
    fertility: region.fertility,
    carryingCapacity: region.carryingCapacity,
    population: region.population,
    pollution: region.pollution,
  };
}

export function calculateMetrics(state: SimulationState): WorldMetrics {
  const regions = Object.values(state.regions);
  return {
    population: regions.reduce((total, region) => total + region.population, 0),
    biodiversity: round(regions.reduce((total, region) => total + region.biodiversity, 0) / regions.length),
    meanTemperature: round(regions.reduce((total, region) => total + region.temperature, 0) / regions.length),
    pollution: round(regions.reduce((total, region) => total + region.pollution, 0) / regions.length),
    civilizations: 12,
    activeConflicts: state.events.filter((event) => event.type === "WAR_STARTED").length,
  };
}

export function getStateChecksum(state: SimulationState): string {
  return stateChecksum(state);
}
