/**
 * Repository interface — the persistence boundary.
 *
 * Two implementations exist:
 *   - MemoryRepository: default for dev/tests/sandbox (zero infrastructure)
 *   - PgRepository:     production PostgreSQL (see migrations/001_init.sql)
 * The world microstate lives in snapshots + the append-only event journal
 * (event sourcing); relational tables serve auth, contributions,
 * notifications, moderation and audit.
 */
import type {
  AIRequestLog,
  Contribution,
  ModerationResult,
  Notification,
  PlanetSummary,
  Role,
  User,
  WorldEvent,
} from "@planet/shared-types";
import type { WorldState } from "@planet/simulation-models";

export interface StoredUser extends User {
  passwordHash: string | null;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  revoked: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface SnapshotRecord {
  id: string;
  planetId: string;
  tick: number;
  year: number;
  state: WorldState;
  createdAt: string;
}

export interface EventQuery {
  planetId: string;
  type?: string;
  cell?: number;
  sinceTick?: number;
  originUserId?: string;
  limit: number;
  offset: number;
}

export interface Repository {
  // users & auth
  createUser(user: StoredUser): Promise<StoredUser>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  listUsers(limit: number, offset: number): Promise<StoredUser[]>;
  updateUserRoles(userId: string, roles: Role[]): Promise<void>;

  storeRefreshToken(record: RefreshTokenRecord): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeRefreshFamily(familyId: string): Promise<void>;

  // planets & world persistence
  createPlanet(summary: PlanetSummary): Promise<void>;
  listPlanets(): Promise<PlanetSummary[]>;
  updatePlanet(summary: PlanetSummary): Promise<void>;
  saveSnapshot(record: SnapshotRecord): Promise<void>;
  latestSnapshot(planetId: string): Promise<SnapshotRecord | null>;
  snapshotAtOrBefore(planetId: string, tick: number): Promise<SnapshotRecord | null>;
  listSnapshotTicks(planetId: string): Promise<number[]>;
  appendEvents(events: WorldEvent[]): Promise<void>;
  queryEvents(query: EventQuery): Promise<WorldEvent[]>;
  eventCount(planetId: string): Promise<number>;
  /** delete every event with tick >= the given tick (used by rollback) */
  truncateEventsFromTick(planetId: string, tick: number): Promise<void>;

  // contributions
  saveContribution(contribution: Contribution): Promise<void>;
  findContribution(id: string): Promise<Contribution | null>;
  updateContribution(contribution: Contribution): Promise<void>;
  contributionsByUser(userId: string): Promise<Contribution[]>;
  contributionsByPlanet(planetId: string): Promise<Contribution[]>;

  // notifications
  saveNotifications(notifications: Notification[]): Promise<void>;
  notificationsForUser(userId: string, limit: number): Promise<Notification[]>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  countUnread(userId: string): Promise<number>;

  // moderation, ai logs, audit, analytics
  saveModeration(result: ModerationResult): Promise<void>;
  moderationQueue(limit: number): Promise<ModerationResult[]>;
  saveAIRequest(log: AIRequestLog): Promise<void>;
  aiUsage(limit: number): Promise<AIRequestLog[]>;
  audit(actorId: string, action: string, detail: Record<string, unknown>): Promise<void>;
  auditLog(limit: number): Promise<Array<{ id: string; actorId: string; action: string; detail: Record<string, unknown>; createdAt: string }>>;

  close(): Promise<void>;
}
