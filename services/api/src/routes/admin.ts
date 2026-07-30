import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ROLES } from "@planet/shared-types";
import { paginationInput } from "@planet/validation";
import { requireRole } from "../auth/guards";
import type { AppContext } from "../context";

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/admin/users", {
    preHandler: requireRole("admin"),
    schema: { tags: ["admin"], summary: "List users" },
  }, async (request) => {
    const page = paginationInput.parse(request.query ?? {});
    const users = await ctx.repository.listUsers(page.limit, page.offset);
    return { users: users.map(({ passwordHash, ...u }) => u) };
  });

  app.post("/admin/users/:userId/roles", {
    preHandler: requireRole("super_admin"),
    schema: { tags: ["admin"], summary: "Assign roles (super admin only)" },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = z.object({ roles: z.array(z.enum(ROLES)).min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(422).send({ error: "invalid_input" });
    const user = await ctx.repository.findUserById(userId);
    if (!user) return reply.code(404).send({ error: "not_found" });
    await ctx.repository.updateUserRoles(userId, body.data.roles);
    await ctx.repository.audit(request.user.sub, "roles_assigned", { userId, roles: body.data.roles });
    return { ok: true };
  });

  app.get("/admin/moderation", {
    preHandler: requireRole("moderator"),
    schema: { tags: ["admin"], summary: "Moderation queue (review + blocked)" },
  }, async (request) => {
    const page = paginationInput.parse(request.query ?? {});
    return { queue: await ctx.repository.moderationQueue(page.limit) };
  });

  app.get("/admin/ai-usage", {
    preHandler: requireRole("admin"),
    schema: { tags: ["admin"], summary: "AI provider usage + cost" },
  }, async (request) => {
    const page = paginationInput.parse(request.query ?? {});
    const logs = await ctx.repository.aiUsage(page.limit);
    const totalCost = logs.reduce((sum, l) => sum + l.costUsd, 0);
    const failures = logs.filter((l) => !l.success).length;
    return { logs, totalCostUsd: Math.round(totalCost * 1e6) / 1e6, failures, sandbox: ctx.ai.isSandbox };
  });

  app.get("/admin/audit", {
    preHandler: requireRole("admin"),
    schema: { tags: ["admin"], summary: "Audit log" },
  }, async (request) => {
    const page = paginationInput.parse(request.query ?? {});
    return { entries: await ctx.repository.auditLog(page.limit) };
  });

  app.get("/admin/simulation", {
    preHandler: requireRole("simulation_admin"),
    schema: { tags: ["admin"], summary: "Simulation status across planets" },
  }, async () => {
    const planets = await ctx.repository.listPlanets();
    return {
      planets: planets.map((p) => ({
        id: p.id,
        name: p.name,
        tick: p.currentTick,
        year: p.currentYear,
        status: p.status,
        autoTicking: ctx.worlds.isAutoTicking(p.id),
        stats: p.stats,
      })),
    };
  });
}
