/**
 * In-memory repository — the zero-infrastructure default used by dev,
 * sandbox and tests. Same contract as the Postgres implementation.
 */
import { randomUUID } from "node:crypto";
import type {
  AIRequestLog,
  Contribution,
  ModerationResult,
  Notification,
  PlanetSummary,
  Role,
  WorldEvent,
} from "@planet/shared-types";
import type { WorldState } from "@planet/simulation-models";
import type {
  EventQuery,
  RefreshTokenRecord,
  Repository,
  SnapshotRecord,
  StoredUser,
} from "./repository";

export class MemoryRepository implements Repository {
  readonly users = new Map<string, StoredUser>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  private readonly planets = new Map<string, PlanetSummary>();
  private readonly snapshots = new Map<string, SnapshotRecord[]>();
  private readonly events = new Map<string, WorldEvent[]>();
  private readonly contributions = new Map<string, Contribution>();
  private readonly notifications = new Map<string, Notification[]>();
  private readonly moderations: ModerationResult[] = [];
  private readonly aiLogs: AIRequestLog[] = [];
  private readonly audits: Array<{ id: string; actorId: string; action: string; detail: Record<string, unknown>; createdAt: string }> = [];

  async createUser(user: StoredUser): Promise<StoredUser> {
    this.users.set(user.id, user);
    return user;
  }
  async findUserByEmail(email: string): Promise<StoredUser | null> {
    for (const user of this.users.values()) if (user.email === email.toLowerCase()) return user;
    return null;
  }
  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.get(id) ?? null;
  }
  async listUsers(limit: number, offset: number): Promise<StoredUser[]> {
    return [...this.users.values()].slice(offset, offset + limit);
  }
  async updateUserRoles(userId: string, roles: Role[]): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.roles = roles;
  }

  async storeRefreshToken(record: RefreshTokenRecord): Promise<void> {
    this.refreshTokens.set(record.tokenHash, record);
  }
  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.refreshTokens.get(tokenHash) ?? null;
  }
  async revokeRefreshToken(id: string): Promise<void> {
    for (const record of this.refreshTokens.values()) {
      if (record.id === id) record.revoked = true;
    }
  }
  async revokeRefreshFamily(familyId: string): Promise<void> {
    for (const record of this.refreshTokens.values()) {
      if (record.familyId === familyId) record.revoked = true;
    }
  }

  async createPlanet(summary: PlanetSummary): Promise<void> {
    this.planets.set(summary.id, summary);
  }
  async listPlanets(): Promise<PlanetSummary[]> {
    return [...this.planets.values()];
  }
  async updatePlanet(summary: PlanetSummary): Promise<void> {
    this.planets.set(summary.id, summary);
  }
  async saveSnapshot(record: SnapshotRecord): Promise<void> {
    const list = this.snapshots.get(record.planetId) ?? [];
    list.push(record);
    this.snapshots.set(record.planetId, list);
  }
  async latestSnapshot(planetId: string): Promise<SnapshotRecord | null> {
    const list = this.snapshots.get(planetId) ?? [];
    return list.length > 0 ? list[list.length - 1]! : null;
  }
  async snapshotAtOrBefore(planetId: string, tick: number): Promise<SnapshotRecord | null> {
    const list = (this.snapshots.get(planetId) ?? []).filter((s) => s.tick <= tick);
    return list.length > 0 ? list[list.length - 1]! : null;
  }
  async listSnapshotTicks(planetId: string): Promise<number[]> {
    return (this.snapshots.get(planetId) ?? []).map((s) => s.tick).sort((a, b) => a - b);
  }
  async appendEvents(events: WorldEvent[]): Promise<void> {
    if (events.length === 0) return;
    const planetId = events[0]!.planetId;
    const list = this.events.get(planetId) ?? [];
    list.push(...events.map((e) => structuredClone(e)));
    this.events.set(planetId, list);
  }
  async queryEvents(query: EventQuery): Promise<WorldEvent[]> {
    let list = this.events.get(query.planetId) ?? [];
    if (query.type) list = list.filter((e) => e.type === query.type);
    if (query.cell !== undefined) list = list.filter((e) => e.cell === query.cell);
    if (query.sinceTick !== undefined) list = list.filter((e) => e.tick >= query.sinceTick!);
    if (query.originUserId) list = list.filter((e) => e.originUserId === query.originUserId);
    return list.slice(query.offset, query.offset + query.limit);
  }
  async eventCount(planetId: string): Promise<number> {
    return (this.events.get(planetId) ?? []).length;
  }
  async truncateEventsFromTick(planetId: string, tick: number): Promise<void> {
    const list = this.events.get(planetId) ?? [];
    this.events.set(planetId, list.filter((e) => e.tick < tick));
  }

  async saveContribution(contribution: Contribution): Promise<void> {
    this.contributions.set(contribution.id, structuredClone(contribution));
  }
  async findContribution(id: string): Promise<Contribution | null> {
    return this.contributions.get(id) ?? null;
  }
  async updateContribution(contribution: Contribution): Promise<void> {
    this.contributions.set(contribution.id, structuredClone(contribution));
  }
  async contributionsByUser(userId: string): Promise<Contribution[]> {
    return [...this.contributions.values()].filter((c) => c.userId === userId);
  }
  async contributionsByPlanet(planetId: string): Promise<Contribution[]> {
    return [...this.contributions.values()].filter((c) => c.planetId === planetId);
  }

  async saveNotifications(batch: Notification[]): Promise<void> {
    for (const n of batch) {
      const list = this.notifications.get(n.userId) ?? [];
      list.push(n);
      this.notifications.set(n.userId, list);
    }
  }
  async notificationsForUser(userId: string, limit: number): Promise<Notification[]> {
    return (this.notifications.get(userId) ?? []).slice(-limit).reverse();
  }
  async markNotificationRead(id: string, userId: string): Promise<void> {
    const list = this.notifications.get(userId) ?? [];
    const target = list.find((n) => n.id === id);
    if (target) target.read = true;
  }
  async countUnread(userId: string): Promise<number> {
    return (this.notifications.get(userId) ?? []).filter((n) => !n.read).length;
  }

  async saveModeration(result: ModerationResult): Promise<void> {
    this.moderations.push(result);
  }
  async moderationQueue(limit: number): Promise<ModerationResult[]> {
    return this.moderations.filter((m) => m.verdict !== "allow").slice(-limit).reverse();
  }
  async saveAIRequest(log: AIRequestLog): Promise<void> {
    this.aiLogs.push(log);
  }
  async aiUsage(limit: number): Promise<AIRequestLog[]> {
    return this.aiLogs.slice(-limit).reverse();
  }
  async audit(actorId: string, action: string, detail: Record<string, unknown>): Promise<void> {
    this.audits.push({ id: randomUUID(), actorId, action, detail, createdAt: new Date().toISOString() });
  }
  async auditLog(limit: number) {
    return this.audits.slice(-limit).reverse();
  }

  async close(): Promise<void> {}
}

export function snapshotRecordOf(planetId: string, state: WorldState): SnapshotRecord {
  return {
    id: `snap-${planetId}-${state.tick}`,
    planetId,
    tick: state.tick,
    year: state.year,
    state: structuredClone(state),
    createdAt: new Date().toISOString(),
  };
}
