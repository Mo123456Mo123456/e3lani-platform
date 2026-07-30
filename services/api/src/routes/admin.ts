import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../domain/errors.js";

const planetBodySchema = z.object({ planetId: z.string().uuid().optional() }).strict();
const rollbackBodySchema = planetBodySchema.extend({
  tick: z.number().int().min(0),
});

async function planetIdFrom(app: FastifyInstance, requested?: string) {
  return requested ?? app.repository.getDefaultPlanetId();
}

export async function adminRoutes(app: FastifyInstance) {
  for (const [action, paused] of [
    ["pause", true],
    ["resume", false],
  ] as const) {
    app.post(
      `/admin/ticks/${action}`,
      {
        preHandler: app.requireRole("admin"),
        schema: {
          tags: ["admin"],
          summary: `${action === "pause" ? "Pause" : "Resume"} simulation ticks`,
          body: {
            type: "object",
            additionalProperties: false,
            properties: { planetId: { type: "string", format: "uuid" } },
          },
        },
      },
      async (request) => {
        const input = planetBodySchema.parse(request.body ?? {});
        const planetId = await planetIdFrom(app, input.planetId);
        await app.repository.setTickPaused(planetId, paused, request.user.sub);
        const summary = await app.repository.getWorldSummary(planetId);
        if (!summary) throw new AppError(404, "PLANET_NOT_FOUND", "Planet does not exist");
        await app.eventBus.publish("world.delta", {
          type: paused ? "simulation.paused" : "simulation.resumed",
          planetId,
          tick: summary.currentTick,
          payload: { actorId: request.user.sub },
          occurredAt: new Date().toISOString(),
        });
        return { data: { planetId, isPaused: paused, tick: summary.currentTick } };
      },
    );
  }

  app.post(
    "/admin/snapshots/rollback",
    {
      preHandler: app.requireRole("admin"),
      schema: {
        tags: ["admin"],
        summary: "Restore a timeline snapshot and pause simulation",
        body: {
          type: "object",
          required: ["tick"],
          additionalProperties: false,
          properties: {
            planetId: { type: "string", format: "uuid" },
            tick: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request) => {
      const input = rollbackBodySchema.parse(request.body);
      const planetId = await planetIdFrom(app, input.planetId);
      const snapshot = await app.repository.rollbackToSnapshot(
        planetId,
        input.tick,
        request.user.sub,
      );
      await app.eventBus.publish("world.delta", {
        type: "timeline.rolled_back",
        planetId,
        tick: snapshot.tick,
        payload: { actorId: request.user.sub, snapshotId: snapshot.id },
        occurredAt: new Date().toISOString(),
      });
      return { data: snapshot };
    },
  );
}
