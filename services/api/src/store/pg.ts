/**
 * PostgreSQL repository — production persistence.
 * Events and snapshots are first-class rows (event sourcing); the world's
 * microstate travels as JSONB inside timeline_snapshots.state.
 */
import pg from "pg";
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
} from "./repository.js";

export class PgRepository implements Repository {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  }

  private async q<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  // --- users ---------------------------------------------------------------
  async createUser(user: StoredUser): Promise<StoredUser> {
    await this.q(
      `INSERT INTO users (id, email, display_name, provider, password_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [user.id, user.email, user.displayName, user.provider, user.passwordHash, user.createdAt],
    );
    await this.q(`INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]);
    for (const role of user.roles) {
      await this.q(`INSERT INTO user_roles (user_id, role) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, role]);
    }
    return user;
  }

  private async hydrate(row: { id: string; email: string; display_name: string; provider: string; password_hash: string | null; created_at: string }): Promise<StoredUser> {
    const roles = await this.q<{ role: Role }>(`SELECT role FROM user_roles WHERE user_id = $1`, [row.id]);
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      provider: row.provider as StoredUser["provider"],
      passwordHash: row.password_hash,
      roles: roles.map((r) => r.role),
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const rows = await this.q<{ id: string; email: string; display_name: string; provider: string; password_hash: string | null; created_at: string }>(
      `SELECT * FROM users WHERE email = $1`, [email.toLowerCase()],
    );
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const rows = await this.q<{ id: string; email: string; display_name: string; provider: string; password_hash: string | null; created_at: string }>(
      `SELECT * FROM users WHERE id = $1`, [id],
    );
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async listUsers(limit: number, offset: number): Promise<StoredUser[]> {
    const rows = await this.q<{ id: string; email: string; display_name: string; provider: string; password_hash: string | null; created_at: string }>(
      `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset],
    );
    return Promise.all(rows.map((r) => this.hydrate(r)));
  }

  async updateUserRoles(userId: string, roles: Role[]): Promise<void> {
    await this.q(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    for (const role of roles) {
      await this.q(`INSERT INTO user_roles (user_id, role) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, role]);
    }
  }

  // --- refresh tokens ------------------------------------------------------
  async storeRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.q(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, revoked, expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [record.id, record.userId, record.tokenHash, record.familyId, record.revoked, record.expiresAt, record.createdAt],
    );
  }
  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const rows = await this.q<{ id: string; user_id: string; token_hash: string; family_id: string; revoked: boolean; expires_at: string; created_at: string }>(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1`, [tokenHash],
    );
    const r = rows[0];
    return r
      ? { id: r.id, userId: r.user_id, tokenHash: r.token_hash, familyId: r.family_id, revoked: r.revoked, expiresAt: new Date(r.expires_at).toISOString(), createdAt: new Date(r.created_at).toISOString() }
      : null;
  }
  async revokeRefreshToken(id: string): Promise<void> {
    await this.q(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [id]);
  }
  async revokeRefreshFamily(familyId: string): Promise<void> {
    await this.q(`UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1`, [familyId]);
  }

  // --- planets --------------------------------------------------------------
  async createPlanet(p: PlanetSummary): Promise<void> {
    await this.q(
      `INSERT INTO planets (id, name, seed, lat_bands, lon_bands, sea_level, current_tick, current_year, years_per_tick, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id, p.name, p.seed, p.latBands, p.lonBands, p.seaLevel, p.currentTick, p.currentYear, p.yearsPerTick, p.status, p.createdAt],
    );
  }
  async listPlanets(): Promise<PlanetSummary[]> {
    const rows = await this.q<{ id: string; name: string; seed: string; lat_bands: number; lon_bands: number; sea_level: number; current_tick: string; current_year: string; years_per_tick: number; status: "running" | "paused"; created_at: string }>(
      `SELECT * FROM planets ORDER BY created_at ASC`,
    );
    return rows.map((r) => ({
      id: r.id, name: r.name, seed: r.seed, latBands: r.lat_bands, lonBands: r.lon_bands,
      seaLevel: r.sea_level, currentTick: Number(r.current_tick), currentYear: Number(r.current_year),
      yearsPerTick: r.years_per_tick, status: r.status,
      stats: { landCells: 0, oceanCells: 0, biomeCounts: {}, civilizationCount: 0, cityCount: 0, speciesCount: 0, plantCount: 0, resourceDepositCount: 0, activeWarCount: 0, eventCount: 0 },
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }
  async updatePlanet(p: PlanetSummary): Promise<void> {
    await this.q(
      `UPDATE planets SET current_tick=$2, current_year=$3, status=$4 WHERE id=$1`,
      [p.id, p.currentTick, p.currentYear, p.status],
    );
  }

  // --- snapshots & events ----------------------------------------------------
  async saveSnapshot(record: SnapshotRecord): Promise<void> {
    await this.q(
      `INSERT INTO timeline_snapshots (id, planet_id, tick, year, state, event_count, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (planet_id, id) DO NOTHING`,
      [record.id, record.planetId, record.tick, record.year, JSON.stringify(record.state), 0, record.createdAt],
    );
  }
  private mapSnapshot(r: { id: string; planet_id: string; tick: string; year: string; state: WorldState; created_at: string }): SnapshotRecord {
    return { id: r.id, planetId: r.planet_id, tick: Number(r.tick), year: Number(r.year), state: r.state, createdAt: new Date(r.created_at).toISOString() };
  }
  async latestSnapshot(planetId: string): Promise<SnapshotRecord | null> {
    const rows = await this.q<{ id: string; planet_id: string; tick: string; year: string; state: WorldState; created_at: string }>(
      `SELECT * FROM timeline_snapshots WHERE planet_id=$1 ORDER BY tick DESC LIMIT 1`, [planetId],
    );
    return rows[0] ? this.mapSnapshot(rows[0]) : null;
  }
  async snapshotAtOrBefore(planetId: string, tick: number): Promise<SnapshotRecord | null> {
    const rows = await this.q<{ id: string; planet_id: string; tick: string; year: string; state: WorldState; created_at: string }>(
      `SELECT * FROM timeline_snapshots WHERE planet_id=$1 AND tick<=$2 ORDER BY tick DESC LIMIT 1`, [planetId, tick],
    );
    return rows[0] ? this.mapSnapshot(rows[0]) : null;
  }
  async listSnapshotTicks(planetId: string): Promise<number[]> {
    const rows = await this.q<{ tick: string }>(
      `SELECT tick FROM timeline_snapshots WHERE planet_id=$1 ORDER BY tick ASC`, [planetId],
    );
    return rows.map((r) => Number(r.tick));
  }
  async appendEvents(events: WorldEvent[]): Promise<void> {
    for (const e of events) {
      await this.q(
        `INSERT INTO world_events (id, planet_id, tick, year, type, cell, cause_ids, cause, actors, data, confidence, importance, origin_user_id, origin_contribution_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (planet_id, id) DO NOTHING`,
        [e.id, e.planetId, e.tick, e.year, e.type, e.cell, JSON.stringify(e.causeIds), e.cause, JSON.stringify(e.actors), JSON.stringify(e.data), e.confidence, e.importance, e.originUserId, e.originContributionId],
      );
    }
  }
  private mapEvent(r: Record<string, unknown>): WorldEvent {
    return {
      id: r.id as string,
      planetId: r.planet_id as string,
      tick: Number(r.tick),
      year: Number(r.year),
      type: r.type as WorldEvent["type"],
      cell: r.cell as number,
      causeIds: r.cause_ids as string[],
      cause: r.cause as string,
      actors: r.actors as WorldEvent["actors"],
      data: r.data as WorldEvent["data"],
      confidence: r.confidence as number,
      importance: r.importance as number,
      originUserId: (r.origin_user_id as string | null) ?? null,
      originContributionId: (r.origin_contribution_id as string | null) ?? null,
    };
  }
  async queryEvents(query: EventQuery): Promise<WorldEvent[]> {
    const clauses = ["planet_id = $1"];
    const params: unknown[] = [query.planetId];
    if (query.type) { params.push(query.type); clauses.push(`type = $${params.length}`); }
    if (query.cell !== undefined) { params.push(query.cell); clauses.push(`cell = $${params.length}`); }
    if (query.sinceTick !== undefined) { params.push(query.sinceTick); clauses.push(`tick >= $${params.length}`); }
    if (query.originUserId) { params.push(query.originUserId); clauses.push(`origin_user_id = $${params.length}`); }
    params.push(query.limit, query.offset);
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM world_events WHERE ${clauses.join(" AND ")} ORDER BY tick ASC, id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapEvent(r));
  }
  async eventCount(planetId: string): Promise<number> {
    const rows = await this.q<{ count: string }>(`SELECT COUNT(*) AS count FROM world_events WHERE planet_id=$1`, [planetId]);
    return Number(rows[0]?.count ?? 0);
  }
  async truncateEventsFromTick(planetId: string, tick: number): Promise<void> {
    await this.q(`DELETE FROM world_events WHERE planet_id=$1 AND tick>=$2`, [planetId, tick]);
  }

  // --- contributions ----------------------------------------------------------
  async saveContribution(c: Contribution): Promise<void> {
    await this.q(
      `INSERT INTO user_contributions (id, user_id, planet_id, raw_text, structured, balance, origin_cell, status, impact_score, created_at_tick, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.userId, c.planetId, c.rawText, JSON.stringify(c.structured), JSON.stringify(c.balance), c.originCell, c.status, c.impactScore, c.createdAtTick, c.createdAt],
    );
  }
  async findContribution(id: string): Promise<Contribution | null> {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM user_contributions WHERE id=$1`, [id]);
    return rows[0] ? this.mapContribution(rows[0]) : null;
  }
  async updateContribution(c: Contribution): Promise<void> {
    await this.q(
      `UPDATE user_contributions SET structured=$2, balance=$3, origin_cell=$4, status=$5, impact_score=$6, created_at_tick=$7 WHERE id=$1`,
      [c.id, JSON.stringify(c.structured), JSON.stringify(c.balance), c.originCell, c.status, c.impactScore, c.createdAtTick],
    );
  }
  private mapContribution(r: Record<string, unknown>): Contribution {
    return {
      id: r.id as string,
      userId: r.user_id as string,
      planetId: r.planet_id as string,
      rawText: r.raw_text as string,
      structured: r.structured as Contribution["structured"],
      balance: r.balance as Contribution["balance"],
      originCell: r.origin_cell as number,
      status: r.status as Contribution["status"],
      impactScore: r.impact_score as number,
      createdAtTick: Number(r.created_at_tick),
      createdAt: new Date(r.created_at as string).toISOString(),
    };
  }
  async contributionsByUser(userId: string): Promise<Contribution[]> {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM user_contributions WHERE user_id=$1 ORDER BY created_at DESC`, [userId]);
    return rows.map((r) => this.mapContribution(r));
  }
  async contributionsByPlanet(planetId: string): Promise<Contribution[]> {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM user_contributions WHERE planet_id=$1 ORDER BY created_at DESC`, [planetId]);
    return rows.map((r) => this.mapContribution(r));
  }

  // --- notifications ------------------------------------------------------------
  async saveNotifications(batch: Notification[]): Promise<void> {
    for (const n of batch) {
      await this.q(
        `INSERT INTO notifications (id, user_id, kind, title, body, event_id, read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [n.id, n.userId, n.kind, n.title, n.body, n.eventId, n.read, n.createdAt],
      );
    }
  }
  async notificationsForUser(userId: string, limit: number): Promise<Notification[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, [userId, limit],
    );
    return rows.map((r) => ({
      id: r.id as string, userId: r.user_id as string, kind: r.kind as string,
      title: r.title as string, body: r.body as string, eventId: (r.event_id as string | null) ?? null,
      read: r.read as boolean, createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  async markNotificationRead(id: string, userId: string): Promise<void> {
    await this.q(`UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2`, [id, userId]);
  }
  async countUnread(userId: string): Promise<number> {
    const rows = await this.q<{ count: string }>(`SELECT COUNT(*) AS count FROM notifications WHERE user_id=$1 AND read=FALSE`, [userId]);
    return Number(rows[0]?.count ?? 0);
  }

  // --- moderation / ai / audit ----------------------------------------------------
  async saveModeration(result: ModerationResult): Promise<void> {
    await this.q(
      `INSERT INTO moderation_results (id, target_id, verdict, reasons, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [result.id, result.targetId, result.verdict, JSON.stringify(result.reasons), result.createdAt],
    );
  }
  async moderationQueue(limit: number): Promise<ModerationResult[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM moderation_results WHERE verdict <> 'allow' ORDER BY created_at DESC LIMIT $1`, [limit],
    );
    return rows.map((r) => ({
      id: r.id as string, targetId: r.target_id as string, verdict: r.verdict as ModerationResult["verdict"],
      reasons: r.reasons as string[], createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  async saveAIRequest(log: AIRequestLog): Promise<void> {
    await this.q(
      `INSERT INTO ai_requests (id, provider, kind, tokens_in, tokens_out, cost_usd, latency_ms, success, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [log.id, log.provider, log.kind, log.tokensIn, log.tokensOut, log.costUsd, log.latencyMs, log.success, log.createdAt],
    );
  }
  async aiUsage(limit: number): Promise<AIRequestLog[]> {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM ai_requests ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows.map((r) => ({
      id: r.id as string, provider: r.provider as string, kind: r.kind as AIRequestLog["kind"],
      tokensIn: r.tokens_in as number, tokensOut: r.tokens_out as number, costUsd: r.cost_usd as number,
      latencyMs: r.latency_ms as number, success: r.success as boolean,
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }
  async audit(actorId: string, action: string, detail: Record<string, unknown>): Promise<void> {
    await this.q(
      `INSERT INTO audit_logs (id, actor_id, action, detail) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [actorId, action, JSON.stringify(detail)],
    );
  }
  async auditLog(limit: number) {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows.map((r) => ({
      id: r.id as string, actorId: r.actor_id as string, action: r.action as string,
      detail: r.detail as Record<string, unknown>, createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
