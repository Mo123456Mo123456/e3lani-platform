import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../domain/errors.js";

const planetQuerySchema = z.object({ planetId: z.string().uuid().optional() });
const pageQuerySchema = planetQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(64).optional(),
});

async function resolvePlanetId(app: FastifyInstance, requested?: string) {
  return requested ?? app.repository.getDefaultPlanetId();
}

export async function worldRoutes(app: FastifyInstance) {
  app.get(
    "/world/summary",
    {
      preHandler: app.authenticate,
      schema: { tags: ["world"], summary: "Get the current world summary" },
    },
    async (request) => {
      const query = planetQuerySchema.parse(request.query);
      const planetId = await resolvePlanetId(app, query.planetId);
      const summary = await app.repository.getWorldSummary(planetId);
      if (!summary) throw new AppError(404, "PLANET_NOT_FOUND", "Planet does not exist");
      return { data: summary };
    },
  );

  app.get(
    "/world/regions",
    {
      preHandler: app.authenticate,
      schema: { tags: ["world"], summary: "List world regions" },
    },
    async (request) => {
      const query = pageQuerySchema.parse(request.query);
      const planetId = await resolvePlanetId(app, query.planetId);
      return {
        data: await app.repository.listRegions(planetId, {
          limit: query.limit,
          cursor: query.cursor,
        }),
      };
    },
  );

  app.get(
    "/world/events",
    {
      preHandler: app.authenticate,
      schema: { tags: ["world"], summary: "List causal world events newest first" },
    },
    async (request) => {
      const query = pageQuerySchema.parse(request.query);
      const planetId = await resolvePlanetId(app, query.planetId);
      return {
        data: await app.repository.listEvents(planetId, {
          limit: query.limit,
          cursor: query.cursor,
        }),
      };
    },
  );

  app.get(
    "/world/timeline",
    {
      preHandler: app.authenticate,
      schema: { tags: ["world"], summary: "List timeline snapshots newest first" },
    },
    async (request) => {
      const query = pageQuerySchema.parse(request.query);
      const planetId = await resolvePlanetId(app, query.planetId);
      return {
        data: await app.repository.listTimeline(planetId, {
          limit: query.limit,
          cursor: query.cursor,
        }),
      };
    },
  );
}
