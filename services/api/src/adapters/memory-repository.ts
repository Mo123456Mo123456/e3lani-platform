import { createHash, randomUUID } from "node:crypto";
import type {
  AuthSession,
  CommitResult,
  GroundingContext,
  PlanetSummary,
  TimelineSnapshot,
  UserIdentity,
  WorldEvent,
  WorldRegion,
} from "../domain/contracts.js";
import type {
  AiAssessmentRecord,
  CommitContributionInput,
  CreateAccountInput,
  Page,
  PageOptions,
  UserWithPassword,
  WorldRepository,
} from "./repository.js";

function stableUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function page<T>(items: T[], options: PageOptions): Page<T> {
  const offset = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const selected = items.slice(safeOffset, safeOffset + options.limit);
  const next = safeOffset + selected.length;
  return {
    items: clone(selected),
    nextCursor: next < items.length ? String(next) : undefined,
  };
}

export class InMemorySandboxRepository implements WorldRepository {
  readonly kind = "memory-sandbox" as const;
  private users = new Map<string, UserWithPassword>();
  private sessions = new Map<string, AuthSession>();
  private summaries = new Map<string, PlanetSummary>();
  private regions = new Map<string, WorldRegion[]>();
  private civilizationIds = new Map<string, string[]>();
  private events = new Map<string, WorldEvent[]>();
  private snapshots = new Map<string, TimelineSnapshot[]>();
  private commits = new Map<string, CommitResult>();
  private assessments: AiAssessmentRecord[] = [];
  private defaultPlanetId = stableUuid("demo-planet");

  constructor() {
    this.seedDemoWorldSync();
  }

  async health() {
    return { ok: true, latencyMs: 0 };
  }

  async close() {}

  async createAccount(input: CreateAccountInput): Promise<UserIdentity> {
    if ([...this.users.values()].some((user) => user.email === input.email)) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
    const user: UserWithPassword = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      roles: [input.role],
    };
    this.users.set(user.id, user);
    const { passwordHash: _, ...identity } = user;
    return clone(identity);
  }

  async findUserByEmail(email: string) {
    const user = [...this.users.values()].find((candidate) => candidate.email === email);
    return user ? clone(user) : undefined;
  }

  async findUserById(id: string) {
    const user = this.users.get(id);
    if (!user) return undefined;
    const { passwordHash: _, ...identity } = user;
    return clone(identity);
  }

  async createSession(userId: string, expiresAt: Date): Promise<AuthSession> {
    const session = { id: randomUUID(), userId, expiresAt: expiresAt.toISOString() };
    this.sessions.set(session.id, session);
    return clone(session);
  }

  async sessionIsActive(sessionId: string, userId: string) {
    const session = this.sessions.get(sessionId);
    return Boolean(
      session &&
        session.userId === userId &&
        new Date(session.expiresAt).getTime() > Date.now(),
    );
  }

  async revokeSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  async getDefaultPlanetId() {
    return this.defaultPlanetId;
  }

  async getWorldSummary(planetId: string) {
    const summary = this.summaries.get(planetId);
    return summary ? clone(summary) : undefined;
  }

  async listRegions(planetId: string, options: PageOptions) {
    return page(this.regions.get(planetId) ?? [], options);
  }

  async listEvents(planetId: string, options: PageOptions) {
    return page((this.events.get(planetId) ?? []).toReversed(), options);
  }

  async listTimeline(planetId: string, options: PageOptions) {
    return page((this.snapshots.get(planetId) ?? []).toReversed(), options);
  }

  async getGroundingContext(planetId: string): Promise<GroundingContext> {
    const summary = await this.getWorldSummary(planetId);
    if (!summary) throw new Error("PLANET_NOT_FOUND");
    return {
      summary,
      regionIds: (this.regions.get(planetId) ?? []).map((region) => region.id),
      civilizationIds: clone(this.civilizationIds.get(planetId) ?? []),
      recentEventIds: (this.events.get(planetId) ?? []).slice(-20).map((event) => event.id),
    };
  }

  async recordAiAssessment(record: AiAssessmentRecord) {
    this.assessments.push(clone(record));
  }

  async commitContribution(input: CommitContributionInput): Promise<CommitResult> {
    const key = `${input.userId}:${input.input.planetId}:${input.idempotencyKey}`;
    const replay = this.commits.get(key);
    if (replay) return { ...clone(replay), replayed: true };

    const summary = this.summaries.get(input.input.planetId);
    if (!summary) throw new Error("PLANET_NOT_FOUND");
    if (summary.isPaused) throw new Error("SIMULATION_PAUSED");

    summary.currentTick += 1;
    for (const effect of input.analysis.effects) {
      if (effect.metric === "stability") {
        summary.stability = Math.max(0, Math.min(1, summary.stability + effect.delta));
      } else if (effect.metric === "biodiversity") {
        summary.biodiversity = Math.max(0, Math.min(1, summary.biodiversity + effect.delta));
      } else if (effect.metric === "temperature") {
        summary.averageTemperature += effect.delta * 4;
      } else if (effect.metric === "population") {
        summary.population = Math.max(0, Math.round(summary.population * (1 + effect.delta)));
      }
    }

    const contributionId = randomUUID();
    const event: WorldEvent = {
      id: randomUUID(),
      planetId: summary.id,
      tick: summary.currentTick,
      title: input.analysis.title,
      summary: input.analysis.summary,
      category: input.analysis.category,
      magnitude: Math.min(
        1,
        input.analysis.effects.reduce((total, effect) => total + Math.abs(effect.delta), 0),
      ),
      causedByContributionId: contributionId,
      createdAt: new Date().toISOString(),
    };
    const snapshot: TimelineSnapshot = {
      id: randomUUID(),
      planetId: summary.id,
      tick: summary.currentTick,
      reason: "contribution_commit",
      state: { summary: clone(summary), analysis: clone(input.analysis) },
      createdAt: new Date().toISOString(),
    };
    this.events.get(summary.id)!.push(event);
    this.snapshots.get(summary.id)!.push(snapshot);

    const result: CommitResult = {
      contributionId,
      tick: summary.currentTick,
      events: [event],
      snapshotId: snapshot.id,
      replayed: false,
    };
    this.commits.set(key, clone(result));
    return result;
  }

  async setTickPaused(planetId: string, paused: boolean, _actorId: string) {
    const summary = this.summaries.get(planetId);
    if (!summary) throw new Error("PLANET_NOT_FOUND");
    summary.isPaused = paused;
  }

  async rollbackToSnapshot(planetId: string, tick: number, _actorId: string) {
    const snapshot = (this.snapshots.get(planetId) ?? []).find((item) => item.tick === tick);
    if (!snapshot) throw new Error("SNAPSHOT_NOT_FOUND");
    const stateSummary = snapshot.state.summary as PlanetSummary | undefined;
    if (!stateSummary) throw new Error("SNAPSHOT_STATE_INVALID");
    this.summaries.set(planetId, clone(stateSummary));
    this.events.set(
      planetId,
      (this.events.get(planetId) ?? []).filter((event) => event.tick <= tick),
    );
    return clone(snapshot);
  }

  async seedDemoWorld() {
    this.seedDemoWorldSync();
    return clone(this.summaries.get(this.defaultPlanetId)!);
  }

  private seedDemoWorldSync() {
    if (this.summaries.has(this.defaultPlanetId)) return;
    const planetId = this.defaultPlanetId;
    const biomeNames = ["Crystal Forest", "Azure Steppe", "Ember Desert", "Polar Bloom"];
    const regionValues: WorldRegion[] = biomeNames.map((biome, index) => ({
      id: stableUuid(`region-${index}`),
      planetId,
      name: `إقليم ${index + 1}`,
      biome,
      latitude: -55 + index * 35,
      longitude: -120 + index * 70,
      population: 1_500_000 + index * 250_000,
      stability: 0.68 + index * 0.03,
    }));
    const eventValues: WorldEvent[] = Array.from({ length: 8 }, (_, index) => ({
      id: stableUuid(`event-${index}`),
      planetId,
      tick: index,
      title: `مرحلة التكوين ${index + 1}`,
      summary: `حلقة سببية حتمية في تاريخ الكوكب التجريبي، المرحلة ${index + 1}.`,
      category: index < 3 ? "ecology" : "society",
      magnitude: 0.1 + index * 0.02,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }));
    const summary: PlanetSummary = {
      id: planetId,
      name: "كوكب أوريون الوليد",
      slug: "orion-newborn",
      currentTick: 7,
      isPaused: false,
      stability: 0.74,
      biodiversity: 0.86,
      averageTemperature: 18.4,
      population: 24_000_000,
      counts: {
        regions: regionValues.length,
        civilizations: 12,
        cities: 40,
        resources: 120,
        species: 300,
        plants: 800,
        technologies: 50,
      },
    };
    const snapshot: TimelineSnapshot = {
      id: stableUuid("snapshot-7"),
      planetId,
      tick: 7,
      reason: "deterministic_seed",
      state: { summary: clone(summary) },
      createdAt: new Date(Date.UTC(2026, 0, 1, 1)).toISOString(),
    };
    this.summaries.set(planetId, summary);
    this.regions.set(planetId, regionValues);
    this.civilizationIds.set(
      planetId,
      Array.from({ length: 12 }, (_, index) => stableUuid(`civilization-${index}`)),
    );
    this.events.set(planetId, eventValues);
    this.snapshots.set(planetId, [snapshot]);
  }
}
