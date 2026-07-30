import type { FastifyInstance } from "fastify";
import { z } from "zod";

const wsQuerySchema = z.object({ planetId: z.string().uuid().optional() });

export async function websocketRoutes(app: FastifyInstance) {
  app.get(
    "/ws",
    {
      websocket: true,
      preValidation: app.authenticate,
      schema: {
        tags: ["realtime"],
        summary: "Authenticated world delta WebSocket",
      },
    },
    (socket, request) => {
      void (async () => {
        const query = wsQuerySchema.parse(request.query);
        const planetId = query.planetId ?? (await app.repository.getDefaultPlanetId());
        const unsubscribe = app.eventBus.subscribe("world.delta", (delta) => {
          if (delta.planetId === planetId && socket.readyState === 1) {
            socket.send(JSON.stringify(delta));
          }
        });
        socket.once("close", unsubscribe);
        socket.send(
          JSON.stringify({
            type: "connected",
            planetId,
            occurredAt: new Date().toISOString(),
          }),
        );
      })().catch(() => socket.close(1011, "Unable to initialize world stream"));
    },
  );
}
