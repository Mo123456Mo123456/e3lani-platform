import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context";

const batchSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string().max(60),
        userId: z.string().optional(),
        planetId: z.string().optional(),
        properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        at: z.string(),
      }),
    )
    .max(100),
});

export function registerAnalyticsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/analytics", {
    schema: { tags: ["analytics"], summary: "Client analytics batch sink" },
  }, async (request, reply) => {
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send({ error: "invalid_input" });
    for (const event of parsed.data.events) {
      await ctx.repository.audit(event.userId ?? "anonymous", `analytics:${event.name}`, {
        planetId: event.planetId,
        ...event.properties,
      });
    }
    return reply.code(204).send();
  });
}
