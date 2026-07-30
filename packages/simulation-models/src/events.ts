import {
  CausalLinkSchema,
  SimulationEventSchema,
  WorldStateSchema,
  type CausalLink,
  type EventCause,
  type EventEffects,
  type LocalizedText,
  type SimulationEvent,
  type SimulationEventType,
  type WorldState,
} from "@kawkab/shared-types";

import { hashHex } from "./prng.js";

export interface EventDraft {
  type: SimulationEventType;
  regionId?: string;
  key: string;
  title: LocalizedText;
  description: LocalizedText;
  causes: EventCause[];
  data?: Record<string, unknown>;
  effects?: EventEffects;
}

export function causeFromSeed(seed: string): EventCause {
  return {
    kind: "SEED",
    referenceId: `seed:${hashHex(seed)}`,
    explanation: {
      ar: "نشأ هذا الحدث من بذرة العالم الحتمية",
      en: "This event originates from the deterministic world seed",
    },
  };
}

export function causeFromTick(tick: number): EventCause {
  return {
    kind: "TICK",
    referenceId: `tick:${tick}`,
    explanation: {
      ar: "نتيجة تطور المحاكاة في هذه الخطوة",
      en: "A result of simulation evolution at this tick",
    },
  };
}

export function causeFromContribution(contributionId: string): EventCause {
  return {
    kind: "CONTRIBUTION",
    referenceId: contributionId,
    explanation: {
      ar: "نتيجة مباشرة لمساهمة المستخدم",
      en: "A direct result of the user contribution",
    },
  };
}

export function causeFromEvent(event: SimulationEvent): EventCause {
  return {
    kind: "EVENT",
    referenceId: event.id,
    explanation: {
      ar: "نتيجة سببية لحدث سابق",
      en: "A causal consequence of a previous event",
    },
  };
}

export function createEvent(
  state: WorldState,
  draft: EventDraft,
): SimulationEvent {
  const sequence = state.eventCount;
  return SimulationEventSchema.parse({
    id: `event:${state.tick}:${sequence}:${hashHex(`${draft.type}:${draft.key}`)}`,
    tick: state.tick,
    sequence,
    type: draft.type,
    regionId: draft.regionId,
    title: draft.title,
    description: draft.description,
    causes: draft.causes,
    data: draft.data ?? {},
    effects: draft.effects ?? {},
  });
}

function assertNoDuplicateIds(
  existing: readonly { id: string }[],
  additions: readonly { id: string }[] | undefined,
): void {
  if (!additions) return;
  const ids = new Set(existing.map((entity) => entity.id));
  for (const addition of additions) {
    if (ids.has(addition.id)) {
      throw new Error(`Duplicate entity ID in event effects: ${addition.id}`);
    }
    ids.add(addition.id);
  }
}

/** Applies an event without mutating either the input state or the event. */
export function applyEvent(
  previousState: WorldState,
  uncheckedEvent: SimulationEvent,
): WorldState {
  const event = SimulationEventSchema.parse(uncheckedEvent);
  if (event.effects.replaceState) {
    return WorldStateSchema.parse(event.effects.replaceState);
  }

  const effects = event.effects;
  assertNoDuplicateIds(previousState.species, effects.addSpecies);
  assertNoDuplicateIds(previousState.plants, effects.addPlants);
  assertNoDuplicateIds(previousState.resources, effects.addResources);
  assertNoDuplicateIds(previousState.civilizations, effects.addCivilizations);
  assertNoDuplicateIds(previousState.technologies, effects.addTechnologies);

  const regionChanges = new Map(
    (effects.regionChanges ?? []).map((change) => [change.regionId, change]),
  );
  const regions = previousState.regions.map((region) => {
    const change = regionChanges.get(region.id);
    if (!change) return region;
    const carryingCapacity =
      change.carryingCapacity ?? region.carryingCapacity;
    const requestedPopulation = change.population ?? region.population;
    return {
      ...region,
      ...(change.pollution === undefined
        ? {}
        : { pollution: change.pollution }),
      ...(change.temperatureC === undefined
        ? {}
        : { temperatureC: change.temperatureC }),
      ...(change.moisture === undefined ? {} : { moisture: change.moisture }),
      ...(change.elevation === undefined
        ? {}
        : { elevation: change.elevation }),
      ...(change.biome === undefined ? {} : { biome: change.biome }),
      ...(change.resourcePotential === undefined
        ? {}
        : { resourcePotential: change.resourcePotential }),
      carryingCapacity,
      population: Math.min(requestedPopulation, carryingCapacity),
    };
  });

  const resourceChanges = new Map(
    (effects.resourceChanges ?? []).map((change) => [
      change.resourceId,
      change,
    ]),
  );
  const resources = [
    ...previousState.resources.map((resource) => {
      const change = resourceChanges.get(resource.id);
      if (!change) return resource;
      const { resourceId: _resourceId, ...updates } = change;
      return { ...resource, ...updates };
    }),
    ...(effects.addResources ?? []),
  ];

  const civilizationChanges = new Map(
    (effects.civilizationChanges ?? []).map((change) => [
      change.civilizationId,
      change,
    ]),
  );
  const civilizations = [
    ...previousState.civilizations.map((civilization) => {
      const change = civilizationChanges.get(civilization.id);
      if (!change) return civilization;
      const { civilizationId: _civilizationId, ...updates } = change;
      return { ...civilization, ...updates };
    }),
    ...(effects.addCivilizations ?? []),
  ];

  return WorldStateSchema.parse({
    ...previousState,
    tick: Math.max(previousState.tick, event.tick),
    eventCount: previousState.eventCount + 1,
    climate: effects.climate ?? previousState.climate,
    regions,
    species: [...previousState.species, ...(effects.addSpecies ?? [])],
    plants: [...previousState.plants, ...(effects.addPlants ?? [])],
    resources,
    civilizations,
    technologies: [
      ...previousState.technologies,
      ...(effects.addTechnologies ?? []),
    ],
  });
}

export function createCausalLink(
  sourceKind: CausalLink["sourceKind"],
  sourceId: string,
  targetEventId: string,
  relationship: CausalLink["relationship"],
  strength: number,
  explanation: LocalizedText,
): CausalLink {
  return CausalLinkSchema.parse({
    id: `cause:${hashHex(
      `${sourceKind}:${sourceId}:${targetEventId}:${relationship}`,
    )}`,
    sourceKind,
    sourceId,
    targetEventId,
    relationship,
    strength,
    explanation,
  });
}

export function createGenesisEvent(world: WorldState): SimulationEvent {
  const initializedState: WorldState = {
    ...world,
    eventCount: 1,
  };
  return SimulationEventSchema.parse({
    id: `event:0:0:${hashHex(`WORLD_INITIALIZED:${world.seed}`)}`,
    tick: 0,
    sequence: 0,
    type: "WORLD_INITIALIZED",
    title: { ar: "وُلد العالم", en: "World initialized" },
    description: {
      ar: "تكوّن عالم حتمي من البذرة والإعدادات المحددة",
      en: "A deterministic world was generated from the given seed and settings",
    },
    causes: [causeFromSeed(world.seed)],
    data: {
      seed: world.seed,
      rows: world.config.rows,
      columns: world.config.columns,
    },
    effects: { replaceState: initializedState },
  });
}

export function replay(
  events: readonly SimulationEvent[],
  initialState?: WorldState,
): WorldState {
  if (!initialState && events.length === 0) {
    throw new Error("replay requires an initial state or at least one event");
  }

  let state = initialState
    ? WorldStateSchema.parse(initialState)
    : undefined;
  for (const uncheckedEvent of events) {
    const event = SimulationEventSchema.parse(uncheckedEvent);
    if (!state) {
      if (!event.effects.replaceState) {
        throw new Error(
          "The first replay event must contain a replacement world state",
        );
      }
      state = WorldStateSchema.parse(event.effects.replaceState);
      continue;
    }
    state = applyEvent(state, event);
  }

  return state as WorldState;
}
