import Fastify from "fastify";

/**
 * Dedicated realtime gateway placeholder.
 * Production WebSocket currently rides on @planet/api `/ws`.
 * This service exists so the monorepo topology matches the target architecture
 * and can be split out without rewriting clients.
 */
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  mode: "proxy_to_api",
  apiWs: process.env.API_WS_URL ?? "ws://localhost:4100/ws",
}));

const port = Number(process.env.PORT ?? 4103);
if (process.env.NODE_ENV !== "test") {
  app.listen({ port, host: "0.0.0.0" });
}
