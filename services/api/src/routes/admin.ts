import type { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { db } from "../db/client.js";
import {
  users,
  aiRequests,
  auditLogs,
  moderationResults,
  userContributions,
  simulationTicks,
  planets,
} from "../db/schema.js";
import { getPrimaryPlanet, asWorldState } from "../services/world-service.js";
import { worldMetrics } from "@planet/simulation-models";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", { preHandler: requireAuth("system_admin") }, async () => {
    const planet = await getPrimaryPlanet();
    const [{ count: userCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [{ count: contribCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userContributions);
    const [{ count: aiCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiRequests);
    const recentTicks = await db
      .select()
      .from(simulationTicks)
      .orderBy(desc(simulationTicks.createdAt))
      .limit(10);
    const metrics = planet ? worldMetrics(asWorldState(planet)) : null;
    return {
      users: userCount,
      contributions: contribCount,
      aiRequests: aiCount,
      planet: planet
        ? {
            id: planet.id,
            status: planet.status,
            tick: planet.tick,
            year: planet.year,
            metrics,
          }
        : null,
      recentTicks,
    };
  });

  app.get("/admin/users", { preHandler: requireAuth("system_admin") }, async () => {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        level: users.level,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(200);
    return { users: rows };
  });

  app.patch<{ Params: { id: string }; Body: { role?: string } }>(
    "/admin/users/:id/role",
    { preHandler: requireAuth("super_admin") },
    async (req, reply) => {
      if (!req.body?.role) return reply.code(400).send({ error: "role_required" });
      await db.update(users).set({ role: req.body.role }).where(eq(users.id, req.params.id));
      await db.insert(auditLogs).values({
        actorId: req.dbUser!.id,
        action: "admin.set_role",
        targetType: "user",
        targetId: req.params.id,
        meta: { role: req.body.role },
      });
      return { ok: true };
    },
  );

  app.get("/admin/contributions", { preHandler: requireAuth("content_moderator") }, async () => {
    const rows = await db
      .select()
      .from(userContributions)
      .orderBy(desc(userContributions.createdAt))
      .limit(100);
    return { contributions: rows };
  });

  app.get("/admin/ai", { preHandler: requireAuth("system_admin") }, async () => {
    const rows = await db.select().from(aiRequests).orderBy(desc(aiRequests.createdAt)).limit(100);
    const cost = rows.reduce((s, r) => s + (r.costUsd ?? 0), 0);
    return { requests: rows, totalCostUsd: cost, sandboxOnly: rows.every((r) => r.sandbox) };
  });

  app.get("/admin/moderation", { preHandler: requireAuth("content_moderator") }, async () => {
    const rows = await db
      .select()
      .from(moderationResults)
      .orderBy(desc(moderationResults.createdAt))
      .limit(100);
    return { results: rows };
  });

  app.get("/admin/audit", { preHandler: requireAuth("system_admin") }, async () => {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
    return { logs: rows };
  });

  app.get("/admin/planets", { preHandler: requireAuth("simulation_manager") }, async () => {
    const rows = await db.select().from(planets);
    return {
      planets: rows.map((p) => ({
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        seed: p.seed,
        tick: p.tick,
        year: p.year,
        status: p.status,
      })),
    };
  });
}
