import {
  NotificationSchema,
  SnapshotSchema,
  WorldStateSchema,
  WorldSummarySchema,
  type Notification,
  type SimulationEvent,
  type Snapshot,
  type WorldState,
  type WorldSummary,
} from "@kawkab/shared-types";

import { hashHex } from "./prng.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function stateChecksum(state: WorldState): string {
  return hashHex(JSON.stringify(canonicalize(state)));
}

export function createSnapshot(
  state: WorldState,
  eventIndex = state.eventCount,
): Snapshot {
  if (!Number.isInteger(eventIndex) || eventIndex < 0) {
    throw new RangeError("eventIndex must be a non-negative integer");
  }
  const checksum = stateChecksum(state);
  return SnapshotSchema.parse({
    id: `snapshot:${state.tick}:${checksum}`,
    tick: state.tick,
    eventIndex,
    checksum,
    state,
  });
}

export function restoreSnapshot(snapshot: Snapshot): WorldState {
  const parsed = SnapshotSchema.parse(snapshot);
  if (stateChecksum(parsed.state) !== parsed.checksum) {
    throw new Error("Snapshot checksum does not match its state");
  }
  return WorldStateSchema.parse(parsed.state);
}

export function summarizeWorld(state: WorldState): WorldSummary {
  const regionCount = state.regions.length;
  const mean = (values: readonly number[]): number =>
    values.reduce((total, value) => total + value, 0) /
    Math.max(1, values.length);

  return WorldSummarySchema.parse({
    worldId: state.id,
    seed: state.seed,
    tick: state.tick,
    regionCount,
    habitableRegionCount: state.regions.filter(
      (region) => region.carryingCapacity > 0,
    ).length,
    totalPopulation: state.regions.reduce(
      (total, region) => total + region.population,
      0,
    ),
    totalCarryingCapacity: state.regions.reduce(
      (total, region) => total + region.carryingCapacity,
      0,
    ),
    meanTemperatureC: mean(
      state.regions.map((region) => region.temperatureC),
    ),
    meanMoisture: mean(state.regions.map((region) => region.moisture)),
    meanPollution: mean(state.regions.map((region) => region.pollution)),
    biodiversity: state.species.length + state.plants.length,
    civilizationCount: state.civilizations.length,
    technologyCount: state.technologies.length,
  });
}

export function notificationFromEvent(
  event: SimulationEvent,
): Notification {
  const severityByType: Partial<
    Record<SimulationEvent["type"], Notification["severity"]>
  > = {
    WAR_STARTED: "CRITICAL",
    DISEASE_OUTBREAK: "CRITICAL",
    VOLCANO_ERUPTED: "CRITICAL",
    RESOURCE_DEPLETED: "WARNING",
    POLLUTION_CHANGED: "WARNING",
    MIGRATION_STARTED: "NOTICE",
    CLIMATE_CHANGED: "NOTICE",
  };
  return NotificationSchema.parse({
    id: `notification:${hashHex(event.id)}`,
    eventId: event.id,
    eventType: event.type,
    tick: event.tick,
    severity: severityByType[event.type] ?? "INFO",
    title: event.title,
    message: event.description,
    regionId: event.regionId,
    read: false,
  });
}
