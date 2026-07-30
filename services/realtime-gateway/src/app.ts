import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { z } from "zod";

const PublishSchema = z.object({
  type: z.string().min(1).max(120),
  planetId: z.string().uuid(),
  payload: z.unknown(),
});

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  await app.register(websocket);
  const subscriptions = new Map<string, Set<import("ws").WebSocket>>();

  app.get("/health", async () => ({
    status: "ok",
    service: "@planet-born/realtime-gateway",
    planets: subscriptions.size,
    clients: new Set([...subscriptions.values()].flatMap((set) => [...set])).size,
  }));

  app.get("/ws", { websocket: true }, (socket) => {
    const joined = new Set<string>();
    socket.send(JSON.stringify({ type: "connected", payload: {}, ts: Date.now() }));

    socket.on("message", (raw) => {
      try {
        const message = z
          .object({
            action: z.literal("subscribe"),
            planetId: z.string().uuid(),
          })
          .parse(JSON.parse(raw.toString()));
        const clients = subscriptions.get(message.planetId) ?? new Set();
        clients.add(socket);
        subscriptions.set(message.planetId, clients);
        joined.add(message.planetId);
        socket.send(
          JSON.stringify({
            type: "subscribed",
            planetId: message.planetId,
            payload: {},
            ts: Date.now(),
          }),
        );
      } catch {
        socket.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Expected { action: \"subscribe\", planetId }" },
            ts: Date.now(),
          }),
        );
      }
    });

    socket.on("close", () => {
      for (const planetId of joined) {
        const clients = subscriptions.get(planetId);
        clients?.delete(socket);
        if (clients?.size === 0) subscriptions.delete(planetId);
      }
    });
  });

  app.post("/publish", async (request, reply) => {
    const input = PublishSchema.parse(request.body);
    const envelope = {
      type: input.type,
      planetId: input.planetId,
      payload: input.payload,
      ts: Date.now(),
    };
    const encoded = JSON.stringify(envelope);
    let delivered = 0;
    for (const socket of subscriptions.get(input.planetId) ?? []) {
      if (socket.readyState === 1) {
        socket.send(encoded);
        delivered += 1;
      }
    }
    return reply.code(202).send({ accepted: true, delivered });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "INVALID_EVENT", issues: error.issues });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "PUBLISH_FAILED" });
  });

  return app;
}
