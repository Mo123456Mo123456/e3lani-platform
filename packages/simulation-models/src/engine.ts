import type {
  CommitContributionRequest,
  PlanetRegion,
  WorldEvent,
  WorldEventType,
  WorldSummary,
} from "@planet/shared-types";

import {
  clamp,
  deterministicUuid,
  SeededRandom,
  stableHash,
} from "./random";
import type {
  CausalEdge,
  ContributionRecord,
  SimulatedEntity,
  WorldSnapshot,
  WorldState,
} from "./state";
import { simulatedDate } from "./world-generator";

export interface TickResult {
  world: WorldState;
  events: WorldEvent[];
}

export interface ContributionResult {
  world: WorldState;
  contribution: ContributionRecord;
  events: WorldEvent[];
}

export function advanceWorld(
  input: WorldState,
  count = 1,
): TickResult {
  if (!Number.isInteger(count) || count < 1 || count > 1_000) {
    throw new Error("Tick count must be an integer between 1 and 1000");
  }

  let world = cloneWorld(input);
  const emitted: WorldEvent[] = [];

  for (let step = 0; step < count; step += 1) {
    const nextTick = world.currentTick + 1;
    const random = new SeededRandom(`${world.seed}:tick:${nextTick}`);
    world.currentTick = nextTick;
    world.currentYear += tickYearDelta(world.tickDuration);

    for (const contribution of world.contributions.filter(
      ({ active }) => active,
    )) {
      const events = simulateContribution(world, contribution, random);
      for (const event of events) {
        world = appendAndApply(world, event);
        emitted.push(event);
      }
    }

    const climateEvent = simulateClimate(world, random);
    if (climateEvent) {
      world = appendAndApply(world, climateEvent);
      emitted.push(climateEvent);
    }

    const tickEvent = createEvent(world, {
      type: "SIMULATION_TICK_COMPLETED",
      regionId: null,
      cause: "scheduled_tick_advance",
      actorIds: [],
      payload: {
        duration: world.tickDuration,
        randomState: random.snapshot(),
      },
      directImpact: {},
      confidence: 1,
    });
    world = appendAndApply(world, tickEvent);
    emitted.push(tickEvent);
  }

  return { world, events: emitted };
}

export function addContribution(
  input: WorldState,
  userId: string,
  request: CommitContributionRequest,
): ContributionResult {
  if (!request.analysis.moderation.accepted) {
    throw new Error("The contribution did not pass moderation");
  }

  const existing = input.contributions.find(
    ({ id }) =>
      id === deterministicUuid(input.id, request.idempotencyKey),
  );
  if (existing) {
    return { world: cloneWorld(input), contribution: existing, events: [] };
  }

  const region = input.regions.find(({ id }) => id === request.regionId);
  if (!region) throw new Error("Target region does not exist");
  if (region.biome === "ocean" && request.analysis.category !== "creature") {
    throw new Error("This contribution cannot begin in an ocean region");
  }

  const contributionId = deterministicUuid(input.id, request.idempotencyKey);
  const compatibility = habitatCompatibility(region, request.analysis.traits);
  const contribution: ContributionRecord = {
    id: contributionId,
    userId,
    regionId: region.id,
    analysis: request.analysis,
    createdAtTick: input.currentTick,
    active: true,
  };
  const pollutionDelta =
    -Math.min(
      region.pollution,
      request.analysis.traits.pollutionAbsorption * region.pollution * 0.08,
    );
  const fertilityDelta =
    request.analysis.category === "plant"
      ? request.analysis.traits.growthRate * compatibility * 0.025
      : 0;
  const event = createEvent(input, {
    type: "CONTRIBUTION_ADDED",
    regionId: region.id,
    cause: "user_confirmed_balanced_contribution",
    contributionId,
    actorIds: [userId],
    payload: {
      contribution,
      compatibility,
      analysisProvider: request.analysis.provider,
      sandboxAnalysis: request.analysis.sandbox,
    },
    directImpact: {
      pollution: pollutionDelta,
      fertility: fertilityDelta,
    },
    confidence: 0.96,
  });

  const world = appendAndApply(input, event);
  return { world, contribution, events: [event] };
}

export function replayWorld(
  initial: WorldState,
  events: readonly WorldEvent[],
): WorldState {
  let world: WorldState = {
    ...cloneWorld(initial),
    events: initial.events.slice(0, 1),
    causalEdges: [],
    contributions: [],
    nextSequence: 1,
  };

  for (const event of [...events]
    .filter(({ sequence }) => sequence > 0)
    .sort((left, right) => left.sequence - right.sequence)) {
    if (event.sequence !== world.nextSequence) {
      throw new Error(
        `Event sequence gap: expected ${world.nextSequence}, got ${event.sequence}`,
      );
    }
    world.currentTick = event.tick;
    world.currentYear = event.year;
    world = appendAndApply(world, event, false);
  }

  return world;
}

export function snapshotWorld(world: WorldState): WorldSnapshot {
  const state = cloneWorld(world);
  return {
    tick: state.currentTick,
    sequence: state.nextSequence - 1,
    stateHash: hashWorld(state),
    state,
  };
}

export function restoreSnapshot(snapshot: WorldSnapshot): WorldState {
  if (hashWorld(snapshot.state) !== snapshot.stateHash) {
    throw new Error("Snapshot integrity check failed");
  }
  return cloneWorld(snapshot.state);
}

export function summarizeWorld(world: WorldState): WorldSummary {
  const count = (kind: SimulatedEntity["kind"]) =>
    world.entities.filter((entity) => entity.kind === kind).length;
  return {
    id: world.id,
    nameAr: world.nameAr,
    nameEn: world.nameEn,
    seed: world.seed,
    currentTick: world.currentTick,
    currentYear: world.currentYear,
    stateHash: hashWorld(world),
    running: world.running,
    tickDuration: world.tickDuration,
    counts: {
      regions: world.regions.length,
      civilizations: count("civilization"),
      species: count("species"),
      plants: count("plant"),
      resources: count("resource"),
      events: world.events.length,
    },
  };
}

export function hashWorld(world: WorldState): string {
  return stableHash({
    id: world.id,
    seed: world.seed,
    currentTick: world.currentTick,
    currentYear: world.currentYear,
    regions: world.regions,
    entities: world.entities,
    contributions: world.contributions,
    causalEdges: world.causalEdges,
    nextSequence: world.nextSequence,
  });
}

function simulateContribution(
  world: WorldState,
  contribution: ContributionRecord,
  random: SeededRandom,
): WorldEvent[] {
  const region = world.regions.find(({ id }) => id === contribution.regionId);
  if (!region) return [];
  const traits = contribution.analysis.traits;
  const age = world.currentTick - contribution.createdAtTick;
  const compatibility = habitatCompatibility(region, traits);
  const events: WorldEvent[] = [];
  const causeEvent = [...world.events]
    .reverse()
    .find(({ contributionId }) => contributionId === contribution.id);

  if (
    contribution.analysis.category === "plant" &&
    random.chance(traits.growthRate * compatibility * 0.55)
  ) {
    const target = nearestCompatibleRegion(
      world.regions,
      region,
      contribution.analysis.possibleBiomes,
    );
    if (target) {
      events.push(
        createEvent(world, {
          type: "PLANT_SPREAD",
          regionId: target.id,
          cause: "habitat_suitability_and_seed_dispersal",
          causeEventIds: causeEvent ? [causeEvent.id] : [],
          contributionId: contribution.id,
          actorIds: [contribution.id],
          payload: {
            sourceRegionId: region.id,
            targetRegionId: target.id,
            contributionAge: age,
          },
          directImpact: {
            fertility: traits.growthRate * 0.008,
            pollution:
              -traits.pollutionAbsorption *
              Math.max(target.pollution, 0.02) *
              0.025,
          },
          confidence: clamp(0.55 + compatibility * 0.35, 0, 1),
        }),
      );
    }
  }

  if (traits.pollutionAbsorption > 0.1 && region.pollution > 0.001) {
    events.push(
      createEvent(
        { ...world, nextSequence: world.nextSequence + events.length },
        {
          type: "POLLUTION_CHANGED",
          regionId: region.id,
          cause: "contribution_pollution_absorption",
          causeEventIds: causeEvent ? [causeEvent.id] : [],
          contributionId: contribution.id,
          actorIds: [contribution.id],
          payload: { contributionAge: age },
          directImpact: {
            pollution: -Math.min(
              region.pollution,
              traits.pollutionAbsorption * traits.growthRate * 0.012,
            ),
          },
          confidence: 0.94,
        },
      ),
    );
  }

  return events;
}

function simulateClimate(
  world: WorldState,
  random: SeededRandom,
): WorldEvent | null {
  const candidates = world.regions.filter(({ biome }) => biome !== "ocean");
  if (candidates.length === 0 || !random.chance(0.08)) return null;
  const region = random.pick(candidates);
  const oscillation =
    Math.sin((world.currentTick + region.index) * 0.37) * 0.15;
  const volcanicPressure =
    region.biome === "volcanic" ? region.resourceRichness * 0.1 : 0;
  const temperatureDelta = oscillation + volcanicPressure;

  return createEvent(world, {
    type: "CLIMATE_CHANGED",
    regionId: region.id,
    cause:
      region.biome === "volcanic"
        ? "seasonal_cycle_and_volcanic_activity"
        : "seasonal_climate_oscillation",
    actorIds: [],
    payload: { oscillation, volcanicPressure },
    directImpact: { temperature: temperatureDelta },
    confidence: 0.82,
  });
}

function createEvent(
  world: WorldState,
  input: {
    type: WorldEventType;
    regionId: string | null;
    cause: string;
    actorIds: string[];
    payload: Record<string, unknown>;
    directImpact: Record<string, number>;
    confidence: number;
    causeEventIds?: string[];
    contributionId?: string | null;
  },
): WorldEvent {
  const sequence = world.nextSequence;
  return {
    id: deterministicUuid(world.id, `event:${sequence}`),
    sequence,
    worldId: world.id,
    type: input.type,
    tick: world.currentTick,
    year: world.currentYear,
    regionId: input.regionId,
    cause: input.cause,
    causeEventIds: input.causeEventIds ?? [],
    actorIds: input.actorIds,
    contributionId: input.contributionId ?? null,
    payload: input.payload,
    confidence: input.confidence,
    directImpact: input.directImpact,
    createdAt: simulatedDate(sequence),
  };
}

function appendAndApply(
  input: WorldState,
  event: WorldEvent,
  validateSequence = true,
): WorldState {
  if (validateSequence && event.sequence !== input.nextSequence) {
    throw new Error(
      `Invalid event sequence: expected ${input.nextSequence}, got ${event.sequence}`,
    );
  }
  const world = cloneWorld(input);
  const regionIndex = event.regionId
    ? world.regions.findIndex(({ id }) => id === event.regionId)
    : -1;

  if (regionIndex >= 0) {
    world.regions[regionIndex] = applyRegionImpact(
      world.regions[regionIndex]!,
      event.directImpact,
    );
  }

  if (event.type === "CONTRIBUTION_ADDED") {
    const contribution = event.payload.contribution as ContributionRecord;
    if (!world.contributions.some(({ id }) => id === contribution.id)) {
      world.contributions.push(contribution);
      world.entities.push({
        id: contribution.id,
        kind:
          contribution.analysis.category === "plant"
            ? "plant"
            : contribution.analysis.category === "resource"
              ? "resource"
              : "species",
        name: contribution.analysis.name,
        regionId: contribution.regionId,
        population: 1,
        health: 1,
        attributes: contribution.analysis.traits,
      });
    }
  }

  for (const causeEventId of event.causeEventIds) {
    const edge: CausalEdge = {
      sourceEventId: causeEventId,
      targetEventId: event.id,
      relation: event.type === "POLLUTION_CHANGED" ? "mitigated" : "caused",
      strength: event.confidence,
      explanation: event.cause,
    };
    if (
      !world.causalEdges.some(
        ({ sourceEventId, targetEventId }) =>
          sourceEventId === edge.sourceEventId &&
          targetEventId === edge.targetEventId,
      )
    ) {
      world.causalEdges.push(edge);
    }
  }

  world.events.push(event);
  world.nextSequence = event.sequence + 1;
  return world;
}

function applyRegionImpact(
  region: PlanetRegion,
  impact: Record<string, number>,
): PlanetRegion {
  return {
    ...region,
    pollution: clamp(region.pollution + (impact.pollution ?? 0), 0, 1),
    fertility: clamp(region.fertility + (impact.fertility ?? 0), 0, 1),
    moisture: clamp(region.moisture + (impact.moisture ?? 0), 0, 1),
    temperature: region.temperature + (impact.temperature ?? 0),
    population: Math.max(
      0,
      Math.round(region.population + (impact.population ?? 0)),
    ),
  };
}

function habitatCompatibility(
  region: PlanetRegion,
  traits: {
    waterNeed: number;
    coldResistance: number;
    heatResistance: number;
    adaptability: number;
  },
): number {
  const waterFit = 1 - Math.abs(region.moisture - traits.waterNeed);
  const temperatureFit =
    region.temperature < 8
      ? traits.coldResistance
      : region.temperature > 28
        ? traits.heatResistance
        : 1;
  return clamp(
    waterFit * 0.45 +
      temperatureFit * 0.35 +
      traits.adaptability * 0.2,
    0,
    1,
  );
}

function nearestCompatibleRegion(
  regions: PlanetRegion[],
  source: PlanetRegion,
  possibleBiomes: readonly string[],
): PlanetRegion | null {
  return (
    regions
      .filter(
        ({ id, biome }) =>
          id !== source.id &&
          biome !== "ocean" &&
          possibleBiomes.includes(biome),
      )
      .sort(
        (left, right) =>
          angularDistance(source, left) - angularDistance(source, right),
      )[0] ?? null
  );
}

function angularDistance(left: PlanetRegion, right: PlanetRegion): number {
  const degrees = Math.PI / 180;
  const leftLatitude = left.latitude * degrees;
  const rightLatitude = right.latitude * degrees;
  const latitudeDelta = (right.latitude - left.latitude) * degrees;
  const longitudeDelta = (right.longitude - left.longitude) * degrees;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tickYearDelta(duration: WorldState["tickDuration"]): number {
  if (duration === "decade") return 10;
  if (duration === "year") return 1;
  return 0;
}

function cloneWorld(world: WorldState): WorldState {
  return structuredClone(world);
}
