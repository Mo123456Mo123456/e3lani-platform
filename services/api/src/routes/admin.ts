import type { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { getRecentEvents, summarize } from "@planet/analytics";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";

function requireAdmin(role: string) {
  return ["content_moderator", "simulation_manager", "system_admin", "super_admin"].includes(
    role,
  );
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const user = req.user as { role: string };
    if (!requireAdmin(user.role)) return reply.code(403).send({ error: "forbidden" });
  });

  app.get("/admin/overview", async () => {
    const [usersCount] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.users);
    const [contribCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.userContributions);
    const [eventsCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.worldEvents);
    const [aiCount] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.aiRequests);
    const planets = await db.select().from(schema.planets);

    return {
      users: usersCount?.c ?? 0,
      contributions: contribCount?.c ?? 0,
      events: eventsCount?.c ?? 0,
      aiRequests: aiCount?.c ?? 0,
      planets,
      analytics: summarize(),
      recentAnalytics: getRecentEvents(20),
    };
  });

  app.get("/admin/users", async () => {
    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.users.role,
        level: schema.users.level,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt));
    return { users };
  });

  app.patch("/admin/users/:id/role", async (req, reply) => {
    const actor = req.user as { role: string; id: string };
    if (!["system_admin", "super_admin"].includes(actor.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const { id } = req.params as { id: string };
    const body = req.body as { role: string };
    await db.update(schema.users).set({ role: body.role }).where(eq(schema.users.id, id));
    await db.insert(schema.auditLogs).values({
      actorId: actor.id,
      action: "admin.set_role",
      target: id,
      meta: { role: body.role },
    });
    return { ok: true };
  });

  app.get("/admin/moderation", async () => {
    const rows = await db
      .select()
      .from(schema.moderationResults)
      .orderBy(desc(schema.moderationResults.createdAt))
      .limit(100);
    return { results: rows };
  });

  app.get("/admin/ai-usage", async () => {
    const rows = await db
      .select()
      .from(schema.aiRequests)
      .orderBy(desc(schema.aiRequests.createdAt))
      .limit(100);
    return { requests: rows };
  });

  app.get("/admin/audit", async () => {
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(200);
    return { logs: rows };
  });

  app.post("/admin/planets/:planetId/status", async (req) => {
    const { planetId } = req.params as { planetId: string };
    const body = req.body as { status: "running" | "paused" };
    await db
      .update(schema.planets)
      .set({ status: body.status })
      .where(eq(schema.planets.id, planetId));
    await db.insert(schema.auditLogs).values({
      actorId: (req.user as { id: string }).id,
      action: "admin.planet_status",
      target: planetId,
      meta: { status: body.status },
    });
    return { ok: true };
  });
}
