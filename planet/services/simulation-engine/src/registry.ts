import {
  createWorld,
  deserializeWorld,
  runTicks,
  serializeWorld,
  takeSnapshot,
  DEFAULT_WORLD_CONFIG,
  type WorldState,
} from "@planet/simulation-models";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface SnapshotEntry {
  tick: number;
  state: WorldState;
}

/**
 * In-memory world registry with periodic snapshots for rollback.
 * Snapshots are also persisted to disk (data dir) so restarts do not lose
 * history in self-hosted dev. The API mirrors events/snapshots to Postgres
 * for durable storage — documented topology decision.
 */
export class WorldRegistry {
  private worlds = new Map<string, WorldState>();
  private snapshots = new Map<string, SnapshotEntry[]>();
  private dataDir: string;

  constructor(dataDir = process.env["ENGINE_DATA_DIR"] ?? path.join(process.cwd(), "data")) {
    this.dataDir = dataDir;
  }

  get(id: string): WorldState | undefined {
    return this.worlds.get(id);
  }

  require(id: string): WorldState {
    const w = this.worlds.get(id);
    if (!w) throw new EngineError(404, `world_not_found:${id}`);
    return w;
  }

  list(): { id: string; name: string; seed: number; tick: number; year: number }[] {
    return [...this.worlds.values()].map((w) => ({
      id: w.id, name: w.name, seed: w.seed, tick: w.tick, year: w.tick * w.yearsPerTick,
    }));
  }

  create(opts: { worldId: string; name: string; seed: number; yearsPerTick?: number }): WorldState {
    const existing = this.worlds.get(opts.worldId);
    if (existing) return existing;
    const world = createWorld({
      worldId: opts.worldId,
      name: opts.name,
      seed: opts.seed,
      yearsPerTick: opts.yearsPerTick ?? 1,
      plantSpecies: Number(process.env["ENGINE_PLANT_SPECIES"] ?? DEFAULT_WORLD_CONFIG.plantSpecies),
      animalSpecies: Number(process.env["ENGINE_ANIMAL_SPECIES"] ?? DEFAULT_WORLD_CONFIG.animalSpecies),
      civilizations: Number(process.env["ENGINE_CIVILIZATIONS"] ?? DEFAULT_WORLD_CONFIG.civilizations),
    });
    this.worlds.set(world.id, world);
    this.snapshots.set(world.id, [{ tick: world.tick, state: takeSnapshot(world) }]);
    return world;
  }

  snapshot(world: WorldState): void {
    const list = this.snapshots.get(world.id) ?? [];
    list.push({ tick: world.tick, state: takeSnapshot(world) });
    // Keep at most 60 snapshots per world.
    while (list.length > 60) list.shift();
    this.snapshots.set(world.id, list);
  }

  snapshotList(id: string): { tick: number }[] {
    return (this.snapshots.get(id) ?? []).map((s) => ({ tick: s.tick }));
  }

  rollback(id: string, tick: number): WorldState {
    const list = this.snapshots.get(id) ?? [];
    // Nearest snapshot at or before the requested tick, then deterministic
    // replay of the remaining ticks (Event Sourcing guarantees identical state).
    const candidate = [...list].reverse().find((s) => s.tick <= tick);
    if (!candidate) throw new EngineError(404, `no_snapshot_at_or_before:${tick}`);
    const restored = takeSnapshot(candidate.state);
    if (restored.tick < tick) runTicks(restored, tick - restored.tick);
    this.worlds.set(id, restored);
    return restored;
  }

  async persist(world: WorldState): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const file = path.join(this.dataDir, `${world.id}.snapshot.json`);
    await writeFile(file, serializeWorld(world));
  }

  async load(id: string): Promise<WorldState | undefined> {
    const file = path.join(this.dataDir, `${id}.snapshot.json`);
    if (!existsSync(file)) return undefined;
    const world = deserializeWorld(await readFile(file, "utf8"));
    this.worlds.set(id, world);
    this.snapshots.set(id, [{ tick: world.tick, state: takeSnapshot(world) }]);
    return world;
  }
}

export class EngineError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
