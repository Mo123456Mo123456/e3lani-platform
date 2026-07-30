import type { FastifyInstance } from "fastify";
import { paginationInput } from "@planet/validation";
import { requireAuth } from "../auth/guards.js";
import type { AppContext } from "../context.js";

export function registerMeRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/me/notifications", {
    preHandler: requireAuth,
    schema: { tags: ["me"], summary: "My notifications" },
  }, async (request) => {
    const page = paginationInput.parse(request.query ?? {});
    const notifications = await ctx.repository.notificationsForUser(request.user.sub, page.limit);
    const unread = await ctx.repository.countUnread(request.user.sub);
    return { notifications, unread };
  });

  app.post("/me/notifications/:id/read", {
    preHandler: requireAuth,
    schema: { tags: ["me"], summary: "Mark a notification as read" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await ctx.repository.markNotificationRead(id, request.user.sub);
    return reply.send({ ok: true });
  });

  app.get("/me/contributions", {
    preHandler: requireAuth,
    schema: { tags: ["me"], summary: "All my contributions across planets" },
  }, async (request) => {
    return { contributions: await ctx.repository.contributionsByUser(request.user.sub) };
  });
}
