import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { authRoutes } from "./routes/auth.js";
import { planetRoutes } from "./routes/planet.js";
import { contributionRoutes } from "./routes/contributions.js";
import { adminRoutes } from "./routes/admin.js";
import { addClient } from "./ws/hub.js";

const app = Fastify({
  logger: true,
  genReqId: () => crypto.randomUUID(),
});

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
  credentials: true,
});
await app.register(cookie);
await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-only-change-me-planet-secret-key",
});
await app.register(rateLimit, {
  max: 200,
  timeWindow: "1 minute",
});
await app.register(swagger, {
  openapi: {
    info: {
      title: "كوكب يولد أمامك API",
      description: "Planet Born Before You — REST + WebSocket API",
      version: "0.1.0",
    },
  },
});
await app.register(swaggerUi, { routePrefix: "/docs" });
await app.register(websocket);

app.decorate("authenticate", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
});

app.get("/health", async () => ({
  ok: true,
  service: "api",
  time: new Date().toISOString(),
}));

app.get("/", async () => ({
  name: "كوكب يولد أمامك",
  tagline: "عالمك، قرارك، أثر لا ينتهي.",
  docs: "/docs",
}));

await app.register(authRoutes, { prefix: "/v1" });
await app.register(planetRoutes, { prefix: "/v1" });
await app.register(contributionRoutes, { prefix: "/v1" });
await app.register(adminRoutes, { prefix: "/v1" });

app.register(async (instance) => {
  instance.get("/ws", { websocket: true }, (socket, req) => {
    const client = addClient(socket);
    socket.send(
      JSON.stringify({
        type: "hello",
        ts: Date.now(),
        payload: { message: "connected" },
      }),
    );
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type: string;
          planetId?: string;
          userId?: string;
        };
        if (msg.type === "subscribe" && msg.planetId) client.planetId = msg.planetId;
        if (msg.type === "auth" && msg.userId) client.userId = msg.userId;
      } catch {
        // ignore malformed
      }
    });
    void req;
  });
});

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4100);

if (process.env.NODE_ENV !== "test") {
  app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { app };
