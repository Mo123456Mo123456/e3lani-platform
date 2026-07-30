import type { SimulationState, TimelineSnapshot, WorldEvent } from "@kawkab/shared-types";
import { createRichDemoState, deserializeState, serializeState, snapshot } from "@kawkab/simulation-engine";
import { checksum } from "@kawkab/simulation-models";
import { sqlite } from "./db/index";

export const DEFAULT_DEMO_SEED = process.env.SIMULATION_SEED ?? "kawkab-rich-demo";

function json<T>(value: T): string {
  return JSON.stringify(value);
}

export function persistEvents(events: WorldEvent[]): void {
  const stmt = sqlite.prepare("INSERT OR IGNORE INTO world_events (id, planet_id, tick, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const write = sqlite.transaction((items: WorldEvent[]) => {
    for (const event of items) stmt.run(event.id, event.planetId, event.tick, event.type, json(event), event.createdAt);
  });
  write(events);
}

export function persistSnapshot(state: SimulationState): TimelineSnapshot {
  const snap = snapshot(state);
  sqlite
    .prepare("INSERT OR REPLACE INTO state_snapshots (id, planet_id, tick, payload, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(snap.id, snap.planetId, snap.tick, json(snap), snap.createdAt);
  return snap;
}

export function persistState(state: SimulationState, events: WorldEvent[] = state.events): void {
  sqlite
    .prepare("INSERT OR REPLACE INTO planets (id, name, seed, age_years, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(state.planet.id, state.planet.name, state.planet.seed, state.planet.ageYears, serializeState(state), state.planet.createdAt);
  persistEvents(events);
  persistSnapshot(state);
}

export function loadPersistedState(seed = DEFAULT_DEMO_SEED): SimulationState | undefined {
  const planetId = `planet-${seed}`;
  const row = sqlite.prepare("SELECT payload FROM planets WHERE id = ?").get(planetId) as { payload: string } | undefined;
  if (!row) return undefined;
  return deserializeState(row.payload);
}

export function ensureDemoWorld(seed = DEFAULT_DEMO_SEED): SimulationState {
  const existing = loadPersistedState(seed);
  if (existing) {
    persistSnapshot(existing);
    return existing;
  }
  const state = createRichDemoState(seed, 24, 70);
  persistState(state);
  return state;
}

export function listTimeline(planetId: string): TimelineSnapshot[] {
  const rows = sqlite.prepare("SELECT payload FROM state_snapshots WHERE planet_id = ? ORDER BY tick ASC").all(planetId) as Array<{ payload: string }>;
  return rows.map((row) => JSON.parse(row.payload) as TimelineSnapshot);
}

export function snapshotAtOrBefore(planetId: string, tick: number): TimelineSnapshot | undefined {
  const row = sqlite
    .prepare("SELECT payload FROM state_snapshots WHERE planet_id = ? AND tick <= ? ORDER BY tick DESC LIMIT 1")
    .get(planetId, tick) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as TimelineSnapshot) : undefined;
}

export function notificationId(userId: string, eventId: string): string {
  return `notification-${checksum({ userId, eventId })}`;
}
