import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Report service and adapter status without probing AI vendors",
      },
    },
    async (_request, reply) => {
      try {
        const database = await app.repository.health();
        return {
          status: "ok",
          sandboxMode: app.config.sandboxMode,
          persistence: { kind: app.repository.kind, ...database },
          ai: app.aiProvider.status,
          eventBus: { kind: app.eventBus.kind },
        };
      } catch (error) {
        return reply.code(503).send({
          status: "degraded",
          sandboxMode: app.config.sandboxMode,
          persistence: {
            kind: app.repository.kind,
            ok: false,
            error: error instanceof Error ? error.message : "Unknown persistence error",
          },
          ai: app.aiProvider.status,
          eventBus: { kind: app.eventBus.kind },
        });
      }
    },
  );
}
