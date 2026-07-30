import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { getDb, getSqlitePath } from '../db/client.js';
import * as s from '../db/schema.js';
import { requireRoles } from '../auth/middleware.js';
import { ROLE_HIERARCHY } from '../auth/roles.js';

/** In-memory system settings (persisted across requests in-process). */
const systemSettings: Record<string, unknown> = {
  simAutoTick: false,
  tickIntervalMs: 60_000,
  moderationAutoApprove: false,
  aiProviderPreferred: process.env.AI_PROVIDER || 'mock',
  maintenanceMode: false,
};

async function loadUserWithRoles(userId?: string) {
  const db = getDb();
  const users = userId
    ? await db.select().from(s.users).where(eq(s.users.id, userId)).limit(1)
    : await db.select().from(s.users);
  const roleRows = await db
    .select({
      userId: s.userRoles.userId,
      role: s.roles.name,
      level: s.roles.level,
    })
    .from(s.userRoles)
    .innerJoin(s.roles, eq(s.userRoles.roleId, s.roles.id));

  const byUser = new Map<string, string[]>();
  for (const r of roleRows) {
    const list = byUser.get(r.userId) || [];
    list.push(r.role);
    byUser.set(r.userId, list);
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    status: u.status,
    createdAt: u.createdAt,
    roles: byUser.get(u.id) || [],
  }));
}

export async function adminRoutes(app: FastifyInstance) {
  // ─── Stats / dashboard ─────────────────────────────────────────────
  app.get(
    '/admin/stats',
    { preHandler: [requireRoles('admin', 'sim_manager', 'content_mod')] },
    async () => {
      const db = getDb();
      const [users, planets, contributions, events, ticks, aiReqs, moderation] = await Promise.all([
        db.select().from(s.users),
        db.select().from(s.planets),
        db.select().from(s.userContributions),
        db.select().from(s.worldEvents),
        db.select().from(s.simulationTicks).limit(500),
        db.select().from(s.aiRequests),
        db.select().from(s.moderationResults),
      ]);

      const pending = contributions.filter((c) => c.status === 'pending' || c.status === 'analyzing');
      const paused = planets.filter((p) => p.status === 'paused');
      const active = planets.filter((p) => p.status === 'active');

      // Events in the last hour (createdAt ISO / sqlite datetime)
      const hourAgo = Date.now() - 60 * 60 * 1000;
      const eventsLastHour = events.filter((e) => {
        const t = Date.parse(e.createdAt.replace(' ', 'T') + 'Z');
        return Number.isFinite(t) && t >= hourAgo;
      }).length;

      const latestTick = ticks.reduce(
        (max, t) => (t.tick > max ? t.tick : max),
        0,
      );

      const aiCostPlaceholder = {
        requests: aiReqs.length,
        estimatedUsd: 0,
        note: 'Cost metering not enabled — sandbox/mock mode',
      };

      return {
        users: users.length,
        planets: planets.length,
        planetsActive: active.length,
        planetsPaused: paused.length,
        contributions: contributions.length,
        contributionsPending: pending.length,
        events: events.length,
        eventsPerHour: eventsLastHour,
        sim: {
          latestTick,
          ticksRecorded: ticks.length,
          pausedCount: paused.length,
          status: paused.length === planets.length && planets.length > 0 ? 'paused' : 'running',
        },
        ai: aiCostPlaceholder,
        moderation: {
          total: moderation.length,
          flagged: moderation.filter((m) => m.status === 'flagged').length,
          rejected: moderation.filter((m) => m.status === 'rejected').length,
        },
        health: {
          api: 'ok',
          db: getSqlitePath(),
        },
      };
    },
  );

  // ─── Users + RBAC ──────────────────────────────────────────────────
  app.get('/admin/users', { preHandler: [requireRoles('admin')] }, async (req) => {
    const q = req.query as { search?: string; role?: string };
    let users = await loadUserWithRoles();
    if (q.search) {
      const sLower = q.search.toLowerCase();
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(sLower) ||
          u.displayName.toLowerCase().includes(sLower) ||
          u.id.includes(q.search!),
      );
    }
    if (q.role) {
      users = users.filter((u) => u.roles.includes(q.role!));
    }
    return { users, roles: ROLE_HIERARCHY };
  });

  app.patch('/admin/users/:id/roles', { preHandler: [requireRoles('super_admin', 'admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        roles: z.array(z.string()).min(1).optional(),
        role: z.string().optional(),
        action: z.enum(['set', 'grant', 'revoke']).default('set'),
      })
      .parse(req.body);

    const db = getDb();
    const userRows = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
    if (!userRows[0]) return reply.code(404).send({ error: 'User not found' });

    const targetRoles = body.roles || (body.role ? [body.role] : []);
    if (!targetRoles.length) return reply.code(400).send({ error: 'roles or role required' });

    for (const name of targetRoles) {
      if (!(ROLE_HIERARCHY as readonly string[]).includes(name)) {
        return reply.code(400).send({ error: `Unknown role: ${name}` });
      }
    }

    // Only super_admin may grant super_admin
    const actorRoles = req.user.roles || [];
    if (targetRoles.includes('super_admin') && !actorRoles.includes('super_admin')) {
      return reply.code(403).send({ error: 'Only super_admin can grant super_admin' });
    }

    if (body.action === 'set') {
      await db.delete(s.userRoles).where(eq(s.userRoles.userId, id));
    }

    for (const name of targetRoles) {
      const roleRows = await db.select().from(s.roles).where(eq(s.roles.name, name)).limit(1);
      if (!roleRows[0]) return reply.code(404).send({ error: `Role not found: ${name}` });

      if (body.action === 'revoke') {
        await db
          .delete(s.userRoles)
          .where(and(eq(s.userRoles.userId, id), eq(s.userRoles.roleId, roleRows[0].id)));
      } else {
        // grant or set — ignore unique conflicts by checking first
        const existing = await db
          .select()
          .from(s.userRoles)
          .where(and(eq(s.userRoles.userId, id), eq(s.userRoles.roleId, roleRows[0].id)))
          .limit(1);
        if (!existing[0]) {
          await db.insert(s.userRoles).values({ id: nanoid(), userId: id, roleId: roleRows[0].id });
        }
      }
    }

    await db.insert(s.auditLogs).values({
      id: nanoid(),
      actorId: req.user.sub,
      action: `roles_${body.action}`,
      resourceType: 'user',
      resourceId: id,
      details: { roles: targetRoles },
      ip: req.ip,
    });

    const [updated] = await loadUserWithRoles(id);
    return { ok: true, user: updated };
  });

  // Back-compat POST alias
  app.post('/admin/users/:id/roles', { preHandler: [requireRoles('super_admin', 'admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ role: z.string(), action: z.enum(['grant', 'revoke', 'set']).optional() }).parse(req.body);
    (req as { body: unknown }).body = { role: body.role, action: body.action || 'grant' };
    // Re-dispatch via shared logic by calling handler path — inline duplicate minimal:
    const db = getDb();
    const roleRows = await db.select().from(s.roles).where(eq(s.roles.name, body.role)).limit(1);
    if (!roleRows[0]) return reply.code(404).send({ error: 'Role not found' });
    const action = body.action || 'grant';
    if (action === 'revoke') {
      await db
        .delete(s.userRoles)
        .where(and(eq(s.userRoles.userId, id), eq(s.userRoles.roleId, roleRows[0].id)));
    } else {
      const existing = await db
        .select()
        .from(s.userRoles)
        .where(and(eq(s.userRoles.userId, id), eq(s.userRoles.roleId, roleRows[0].id)))
        .limit(1);
      if (!existing[0]) {
        await db.insert(s.userRoles).values({ id: nanoid(), userId: id, roleId: roleRows[0].id });
      }
    }
    await db.insert(s.auditLogs).values({
      id: nanoid(),
      actorId: req.user.sub,
      action: `grant_role`,
      resourceType: 'user',
      resourceId: id,
      details: { role: body.role, action },
      ip: req.ip,
    });
    return { ok: true };
  });

  // ─── Planets ───────────────────────────────────────────────────────
  app.get('/admin/planets', { preHandler: [requireRoles('admin', 'sim_manager')] }, async () => {
    const db = getDb();
    const planets = await db.select().from(s.planets);
    return { planets };
  });

  // ─── Simulation controls ───────────────────────────────────────────
  app.post(
    '/admin/simulation/pause',
    { preHandler: [requireRoles('admin', 'sim_manager')] },
    async (req) => {
      const body = z.object({ planetId: z.string().optional() }).parse(req.body || {});
      const db = getDb();
      if (body.planetId) {
        await db.update(s.planets).set({ status: 'paused' }).where(eq(s.planets.id, body.planetId));
      } else {
        const all = await db.select().from(s.planets);
        for (const p of all) {
          await db.update(s.planets).set({ status: 'paused' }).where(eq(s.planets.id, p.id));
        }
      }
      await db.insert(s.auditLogs).values({
        id: nanoid(),
        actorId: req.user.sub,
        action: 'sim_pause',
        resourceType: 'planet',
        resourceId: body.planetId || '*',
        details: {},
        ip: req.ip,
      });
      return { ok: true, status: 'paused' };
    },
  );

  app.post(
    '/admin/simulation/resume',
    { preHandler: [requireRoles('admin', 'sim_manager')] },
    async (req) => {
      const body = z.object({ planetId: z.string().optional() }).parse(req.body || {});
      const db = getDb();
      if (body.planetId) {
        await db.update(s.planets).set({ status: 'active' }).where(eq(s.planets.id, body.planetId));
      } else {
        const all = await db.select().from(s.planets);
        for (const p of all) {
          await db.update(s.planets).set({ status: 'active' }).where(eq(s.planets.id, p.id));
        }
      }
      await db.insert(s.auditLogs).values({
        id: nanoid(),
        actorId: req.user.sub,
        action: 'sim_resume',
        resourceType: 'planet',
        resourceId: body.planetId || '*',
        details: {},
        ip: req.ip,
      });
      return { ok: true, status: 'active' };
    },
  );

  app.post(
    '/admin/simulation/tick',
    { preHandler: [requireRoles('admin', 'sim_manager')] },
    async (req, reply) => {
      const body = z.object({ planetId: z.string().min(1) }).parse(req.body);
      const db = getDb();
      const rows = await db.select().from(s.planets).where(eq(s.planets.id, body.planetId)).limit(1);
      if (!rows[0]) return reply.code(404).send({ error: 'Planet not found' });
      if (rows[0].status === 'paused') {
        return reply.code(409).send({ error: 'Planet simulation is paused' });
      }
      const { runSimulationTick } = await import('../services/simulation-client.js');
      const { publish } = await import('../ws-bridge.js');
      const planet = rows[0];
      const tick = planet.currentTick + 1;
      const delta = await runSimulationTick({ planetId: body.planetId, seed: planet.seed, tick });
      for (const ev of delta.events) {
        await db.insert(s.worldEvents).values({
          id: nanoid(),
          planetId: body.planetId,
          tick,
          type: ev.type,
          title: ev.title,
          description: ev.description,
          severity: ev.severity,
          actors: ev.actors,
          payload: ev.payload,
        });
      }
      await db.insert(s.simulationTicks).values({
        id: nanoid(),
        planetId: body.planetId,
        tick,
        year: delta.year,
        deltaSummary: { source: delta.source },
      });
      await db
        .update(s.planets)
        .set({ currentTick: tick, ageYears: delta.year })
        .where(eq(s.planets.id, body.planetId));
      publish({ type: 'planet.delta', planetId: body.planetId, tick, events: delta.events, patches: delta.patches });
      await db.insert(s.auditLogs).values({
        id: nanoid(),
        actorId: req.user.sub,
        action: 'sim_tick',
        resourceType: 'planet',
        resourceId: body.planetId,
        details: { tick, source: delta.source },
        ip: req.ip,
      });
      return { ok: true, tick, delta };
    },
  );

  app.get(
    '/admin/simulation/ticks',
    { preHandler: [requireRoles('admin', 'sim_manager')] },
    async (req) => {
      const q = req.query as { planetId?: string; limit?: string };
      const db = getDb();
      const limit = Math.min(Number(q.limit || 100), 500);
      if (q.planetId) {
        const ticks = await db
          .select()
          .from(s.simulationTicks)
          .where(eq(s.simulationTicks.planetId, q.planetId))
          .limit(limit);
        return { ticks };
      }
      return { ticks: await db.select().from(s.simulationTicks).limit(limit) };
    },
  );

  app.get(
    '/admin/snapshots',
    { preHandler: [requireRoles('admin', 'sim_manager')] },
    async (req) => {
      const q = req.query as { planetId?: string };
      const db = getDb();
      if (q.planetId) {
        return {
          snapshots: await db
            .select()
            .from(s.timelineSnapshots)
            .where(eq(s.timelineSnapshots.planetId, q.planetId)),
        };
      }
      return { snapshots: await db.select().from(s.timelineSnapshots).limit(200) };
    },
  );

  app.post(
    '/admin/snapshots/:id/rollback',
    { preHandler: [requireRoles('admin', 'sim_manager')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const snaps = await db
        .select()
        .from(s.timelineSnapshots)
        .where(eq(s.timelineSnapshots.id, id))
        .limit(1);
      if (!snaps[0]) return reply.code(404).send({ error: 'Snapshot not found' });
      const snap = snaps[0];

      await db
        .update(s.planets)
        .set({
          currentTick: snap.tick,
          ageYears: snap.year,
          metadata: {
            ...(typeof snap.state === 'object' && snap.state ? snap.state : {}),
            rolledBackFrom: id,
            rolledBackAt: new Date().toISOString(),
          },
        })
        .where(eq(s.planets.id, snap.planetId));

      await db.insert(s.auditLogs).values({
        id: nanoid(),
        actorId: req.user.sub,
        action: 'snapshot_rollback',
        resourceType: 'timeline_snapshot',
        resourceId: id,
        details: { planetId: snap.planetId, tick: snap.tick, year: snap.year },
        ip: req.ip,
      });

      const { publish } = await import('../ws-bridge.js');
      publish({
        type: 'planet.rollback',
        planetId: snap.planetId,
        tick: snap.tick,
        payload: { snapshotId: id },
      });

      return { ok: true, planetId: snap.planetId, tick: snap.tick, year: snap.year };
    },
  );

  // ─── Contributions / moderation queue ──────────────────────────────
  app.get(
    '/admin/contributions',
    { preHandler: [requireRoles('admin', 'content_mod')] },
    async (req) => {
      const q = req.query as { status?: string };
      const db = getDb();
      let rows = await db.select().from(s.userContributions).limit(300);
      if (q.status) rows = rows.filter((r) => r.status === q.status);
      return { contributions: rows };
    },
  );

  app.post(
    '/admin/contributions/:id/approve',
    { preHandler: [requireRoles('admin', 'content_mod')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const rows = await db
        .select()
        .from(s.userContributions)
        .where(eq(s.userContributions.id, id))
        .limit(1);
      if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
      await db
        .update(s.userContributions)
        .set({ status: 'balanced' })
        .where(eq(s.userContributions.id, id));
      await db.insert(s.moderationResults).values({
        id: nanoid(),
        contributionId: id,
        status: 'approved',
        reasons: [],
        score: 1,
        reviewerId: req.user.sub,
      });
      await db.insert(s.auditLogs).values({
        id: nanoid(),
        actorId: req.user.sub,
        action: 'contribution_approve',
        resourceType: 'contribution',
        resourceId: id,
        details: {},
        ip: req.ip,
      });
      return { ok: true, status: 'balanced' };
    },
  );

  app.post(
    '/admin/contributions/:id/reject',
    { preHandler: [requireRoles('admin', 'content_mod')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = z.object({ reason: z.string().optional() }).parse(req.body || {});
      const db = getDb();
      const rows = await db
        .select()
        .from(s.userContributions)
        .where(eq(s.userContributions.id, id))
        .limit(1);
      if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
      await db
        .update(s.userContributions)
        .set({ status: 'rejected' })
        .where(eq(s.userContributions.id, id));
      await db.insert(s.moderationResults).values({
        id: nanoid(),
        contributionId: id,
        status: 'rejected',
        reasons: body.reason ? [body.reason] : ['rejected_by_moderator'],
        score: 0,
        reviewerId: req.user.sub,
      });
      await db.insert(s.auditLogs).values({
        id: nanoid(),
        actorId: req.user.sub,
        action: 'contribution_reject',
        resourceType: 'contribution',
        resourceId: id,
        details: { reason: body.reason },
        ip: req.ip,
      });
      return { ok: true, status: 'rejected' };
    },
  );

  app.get(
    '/admin/moderation',
    { preHandler: [requireRoles('admin', 'content_mod')] },
    async () => {
      const db = getDb();
      const reports = await db.select().from(s.moderationResults).limit(300);
      return { reports };
    },
  );

  // ─── Events browser ────────────────────────────────────────────────
  app.get(
    '/admin/events',
    { preHandler: [requireRoles('admin', 'sim_manager', 'content_mod')] },
    async (req) => {
      const q = req.query as { planetId?: string; type?: string; limit?: string };
      const db = getDb();
      const limit = Math.min(Number(q.limit || 200), 500);
      let events = q.planetId
        ? await db.select().from(s.worldEvents).where(eq(s.worldEvents.planetId, q.planetId)).limit(limit)
        : await db.select().from(s.worldEvents).limit(limit);
      if (q.type) events = events.filter((e) => e.type === q.type);
      return { events };
    },
  );

  // ─── AI requests / cost monitor ────────────────────────────────────
  app.get('/admin/ai-requests', { preHandler: [requireRoles('admin')] }, async (req) => {
    const q = req.query as { limit?: string };
    const db = getDb();
    const limit = Math.min(Number(q.limit || 200), 500);
    const requests = await db.select().from(s.aiRequests).limit(limit);
    const byProvider: Record<string, number> = {};
    let totalLatency = 0;
    let withLatency = 0;
    for (const r of requests) {
      byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
      if (r.latencyMs != null) {
        totalLatency += r.latencyMs;
        withLatency += 1;
      }
    }
    return {
      requests,
      summary: {
        total: requests.length,
        byProvider,
        avgLatencyMs: withLatency ? Math.round(totalLatency / withLatency) : null,
        estimatedCostUsd: 0,
        note: 'Cost metering placeholder — enable billing hooks in production',
      },
    };
  });

  // ─── Audit logs ────────────────────────────────────────────────────
  app.get('/admin/audit', { preHandler: [requireRoles('admin')] }, async (req) => {
    const q = req.query as { limit?: string; action?: string };
    const db = getDb();
    const limit = Math.min(Number(q.limit || 200), 500);
    let logs = await db.select().from(s.auditLogs).limit(limit);
    if (q.action) logs = logs.filter((l) => l.action === q.action);
    return { logs };
  });

  // ─── Health detail ─────────────────────────────────────────────────
  app.get(
    '/admin/health-detail',
    { preHandler: [requireRoles('admin', 'sim_manager')] },
    async () => {
      const checks: Array<{ name: string; ok: boolean; detail?: string; latencyMs?: number }> = [];

      const t0 = Date.now();
      try {
        const db = getDb();
        await db.select({ id: s.users.id }).from(s.users).limit(1);
        checks.push({ name: 'sqlite', ok: true, detail: getSqlitePath(), latencyMs: Date.now() - t0 });
      } catch (e) {
        checks.push({ name: 'sqlite', ok: false, detail: String(e) });
      }

      async function probe(name: string, url: string | undefined) {
        if (!url) {
          checks.push({ name, ok: false, detail: 'URL not configured' });
          return;
        }
        const start = Date.now();
        try {
          const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
            signal: AbortSignal.timeout(2500),
          });
          checks.push({
            name,
            ok: res.ok,
            detail: `${res.status}`,
            latencyMs: Date.now() - start,
          });
        } catch (e) {
          checks.push({ name, ok: false, detail: String(e), latencyMs: Date.now() - start });
        }
      }

      await Promise.all([
        probe('simulation-engine', process.env.SIM_ENGINE_URL),
        probe('ai-orchestrator', process.env.AI_ORCHESTRATOR_URL),
        probe('realtime-gateway', process.env.REALTIME_URL),
      ]);

      checks.push({
        name: 'api',
        ok: true,
        detail: '@planet/api',
      });

      return {
        ok: checks.every((c) => c.ok || c.name === 'simulation-engine' || c.name === 'ai-orchestrator' || c.name === 'realtime-gateway'),
        time: new Date().toISOString(),
        checks,
        settings: systemSettings,
      };
    },
  );

  // ─── Settings ──────────────────────────────────────────────────────
  app.get('/admin/settings', { preHandler: [requireRoles('admin')] }, async () => {
    return { settings: systemSettings };
  });

  app.patch('/admin/settings', { preHandler: [requireRoles('super_admin', 'admin')] }, async (req) => {
    const body = z.record(z.unknown()).parse(req.body || {});
    Object.assign(systemSettings, body);
    const db = getDb();
    await db.insert(s.auditLogs).values({
      id: nanoid(),
      actorId: req.user.sub,
      action: 'settings_update',
      resourceType: 'system',
      resourceId: 'settings',
      details: body,
      ip: req.ip,
    });
    return { ok: true, settings: systemSettings };
  });
}
