/**
 * WorldManager — owns one SimulationEngine per planet, persists events and
 * snapshots through the repository, derives user notifications from the
 * event stream, and broadcasts deltas to realtime subscribers.
 */
import { randomUUID } from "node:crypto";
import type {
  Contribution,
  Notification,
  PlanetSummary,
  RealtimeMessage,
  WorldEvent,
} from "@planet/shared-types";
import {
  SimulationEngine,
  applyContribution,
  rngFromString,
  type EmitInput,
  type EngineConfig,
  type WorldState,
} from "@planet/simulation-models";
import { snapshotRecordOf, type MemoryRepository } from "../store/memory";
import type { Repository } from "../store/repository";
import { notificationForEvent } from "../notifications/service";

export interface WorldManagerOptions {
  repository: Repository;
  yearsPerTick: number;
  snapshotInterval: number;
  engineConfig?: Partial<EngineConfig>;
}

type Subscriber = (message: RealtimeMessage) => void;

export class WorldManager {
  private readonly engines = new Map<string, SimulationEngine>();
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** planetId -> number of journal entries already persisted */
  private readonly persistedJournalLen = new Map<string, number>();

  constructor(private readonly options: WorldManagerOptions) {}

  /** create a brand-new planet from a seed */
  async createPlanet(seed: string, name: string, engineConfig: Partial<EngineConfig> = {}): Promise<PlanetSummary> {
    const planetId = `planet-${randomUUID().slice(0, 8)}`;
    const engine = SimulationEngine.genesis({
      planetId,
      seed,
      yearsPerTick: this.options.yearsPerTick,
      snapshotInterval: this.options.snapshotInterval,
      ...this.options.engineConfig,
      ...engineConfig,
    });
    this.engines.set(planetId, engine);
    const summary = this.summaryOf(engine, name);
    await this.options.repository.createPlanet(summary);
    await this.options.repository.saveSnapshot(snapshotRecordOf(planetId, engine.state));
    await this.options.repository.appendEvents(engine.journal);
    this.persistedJournalLen.set(planetId, engine.journal.length);
    return summary;
  }

  /** hydrate an engine for a planet from the latest stored snapshot */
  async ensureLoaded(planetId: string): Promise<SimulationEngine> {
    const existing = this.engines.get(planetId);
    if (existing) return existing;
    const snapshot = await this.options.repository.latestSnapshot(planetId);
    if (!snapshot) throw new Error(`planet ${planetId} not found`);
    const planets = await this.options.repository.listPlanets();
    const meta = planets.find((p) => p.id === planetId);
    const engine = SimulationEngine.fromSnapshot(
      {
        planetId,
        seed: snapshot.state.seed,
        yearsPerTick: meta?.yearsPerTick ?? this.options.yearsPerTick,
        snapshotInterval: this.options.snapshotInterval,
        worldgen: {},
        initialCivilizations: 0,
        initialSpecies: 0,
        initialPlants: 0,
        initialTechs: 0,
      },
      snapshot.state,
      await this.options.repository.queryEvents({ planetId, limit: 100000, offset: 0 }),
    );
    this.engines.set(planetId, engine);
    this.persistedJournalLen.set(planetId, engine.journal.length);
    return engine;
  }

  engineFor(planetId: string): SimulationEngine {
    const engine = this.engines.get(planetId);
    if (!engine) throw new Error(`planet ${planetId} not loaded`);
    return engine;
  }

  async advance(planetId: string, ticks: number): Promise<WorldEvent[]> {
    const engine = await this.ensureLoaded(planetId);
    const emitted: WorldEvent[] = [];
    for (let i = 0; i < ticks; i++) {
      const batch = engine.tick();
      emitted.push(...batch);
      if (batch.length > 0 || i === ticks - 1) {
        this.broadcast(planetId, { kind: "tick", tick: engine.state.tick, year: engine.state.year });
        if (batch.length > 0) this.broadcast(planetId, { kind: "events", events: batch });
        const delta = engine.getDelta();
        if (delta) this.broadcast(planetId, { kind: "delta", changes: delta });
      }
    }
    await this.persist(engine);
    await this.deriveNotifications(planetId, emitted);
    await this.syncSummary(engine);
    return emitted;
  }

  async rollback(planetId: string, tick: number): Promise<boolean> {
    const engine = await this.ensureLoaded(planetId);
    const placed = (await this.options.repository.contributionsByPlanet(planetId)).filter(
      (c) => c.status === "placed",
    );
    const placements = placed.map((c, applyOrder) => ({
      createdAtTick: c.createdAtTick,
      applyOrder,
      apply: (state: WorldState, emit: (input: EmitInput) => WorldEvent) => {
        applyContribution(state, { ...c, structured: structuredClone(c.structured) }, rngFromString(`${c.id}:apply`), emit);
      },
    }));
    const result = engine.rollbackTo(tick, placements);
    if (!result.ok) return false;
    // re-sync the store: wipe everything from the snapshot point and re-append
    // the deterministically replayed journal (identical ids)
    await this.options.repository.truncateEventsFromTick(planetId, result.snapTick);
    await this.options.repository.appendEvents(engine.journal.slice(result.journalLenAtSnap));
    // placements that happened "after" the target moment are undone
    for (const c of placed) {
      if (c.createdAtTick >= tick) {
        await this.options.repository.updateContribution({ ...c, status: "analyzed", originCell: -1 });
      }
    }
    this.persistedJournalLen.set(planetId, engine.journal.length);
    await this.persist(engine, true);
    await this.syncSummary(engine);
    return true;
  }

  startAutoTick(planetId: string, intervalMs: number): void {
    this.stopAutoTick(planetId);
    const timer = setInterval(() => {
      void this.advance(planetId, 1).catch((err) => {
        console.error(`auto-tick failed for ${planetId}:`, err);
        this.stopAutoTick(planetId);
      });
    }, intervalMs);
    timer.unref?.();
    this.timers.set(planetId, timer);
    void this.syncSummary(this.engineFor(planetId), "running");
  }

  stopAutoTick(planetId: string): void {
    const timer = this.timers.get(planetId);
    if (timer) clearInterval(timer);
    this.timers.delete(planetId);
    if (this.engines.has(planetId)) {
      void this.syncSummary(this.engineFor(planetId), "paused");
    }
  }

  isAutoTicking(planetId: string): boolean {
    return this.timers.has(planetId);
  }

  subscribe(planetId: string, subscriber: Subscriber): () => void {
    const set = this.subscribers.get(planetId) ?? new Set<Subscriber>();
    set.add(subscriber);
    this.subscribers.set(planetId, set);
    return () => set.delete(subscriber);
  }

  private broadcast(planetId: string, message: RealtimeMessage): void {
    for (const subscriber of this.subscribers.get(planetId) ?? []) {
      try {
        subscriber(message);
      } catch {
        // a dead subscriber must not break the tick loop
      }
    }
  }

  /** place a validated contribution into the live world */
  async placeContribution(planetId: string, contribution: Contribution): Promise<WorldEvent[]> {
    const engine = await this.ensureLoaded(planetId);
    const rng = rngFromString(`${contribution.id}:apply`);
    const startIdx = engine.journal.length;
    applyContribution(engine.state, contribution, rng, engine.makeEmitter());
    const batch = engine.journal.slice(startIdx);
    await this.persist(engine);
    await this.options.repository.updateContribution(contribution);
    this.broadcast(planetId, { kind: "events", events: batch });
    this.broadcast(planetId, { kind: "contribution", contribution });
    await this.deriveNotifications(planetId, batch);
    return batch;
  }

  private async persist(engine: SimulationEngine, forceSnapshot = false): Promise<void> {
    const { planetId } = engine.state;
    const persistedLen = this.persistedJournalLen.get(planetId) ?? 0;
    const fresh = engine.journal.slice(persistedLen);
    if (fresh.length > 0) {
      await this.options.repository.appendEvents(fresh);
      this.persistedJournalLen.set(planetId, engine.journal.length);
    }
    const latest = await this.options.repository.latestSnapshot(planetId);
    if (
      forceSnapshot ||
      !latest ||
      engine.state.tick - latest.tick >= engine.config.snapshotInterval
    ) {
      engine.snapshotNow();
      await this.options.repository.saveSnapshot(snapshotRecordOf(planetId, engine.state));
    }
  }

  private async deriveNotifications(planetId: string, events: WorldEvent[]): Promise<void> {
    const byUser = new Map<string, Notification[]>();
    for (const event of events) {
      if (!event.originUserId) continue;
      const notification = notificationForEvent(event);
      if (!notification) continue;
      const list = byUser.get(event.originUserId) ?? [];
      list.push(notification);
      byUser.set(event.originUserId, list);
    }
    for (const [userId, batch] of byUser) {
      await this.options.repository.saveNotifications(batch);
      for (const notification of batch) {
        this.broadcast(planetId, { kind: "notification", notification });
        void userId;
      }
    }
  }

  private summaryOf(engine: SimulationEngine, name: string): PlanetSummary {
    return {
      id: engine.state.planetId,
      name,
      seed: engine.state.seed,
      latBands: engine.state.grid.latBands,
      lonBands: engine.state.grid.lonBands,
      seaLevel: engine.state.grid.seaLevel,
      currentTick: engine.state.tick,
      currentYear: engine.state.year,
      yearsPerTick: engine.state.yearsPerTick,
      riverCount: engine.config.worldgen.riverCount,
      resourceDensity: engine.config.worldgen.resourceDensity,
      status: this.isAutoTicking(engine.state.planetId) ? "running" : "paused",
      stats: engine.stats(),
      createdAt: new Date().toISOString(),
    };
  }

  private async syncSummary(engine: SimulationEngine, status?: "running" | "paused"): Promise<void> {
    const planets = await this.options.repository.listPlanets();
    const meta = planets.find((p) => p.id === engine.state.planetId);
    if (!meta) return;
    const updated: PlanetSummary = {
      ...meta,
      currentTick: engine.state.tick,
      currentYear: engine.state.year,
      status: status ?? (this.isAutoTicking(engine.state.planetId) ? "running" : "paused"),
      stats: engine.stats(),
    };
    await this.options.repository.updatePlanet(updated);
  }

  async shutdown(): Promise<void> {
    for (const planetId of [...this.timers.keys()]) this.stopAutoTick(planetId);
  }
}

export type { MemoryRepository };
export type { WorldState };
