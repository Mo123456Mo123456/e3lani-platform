import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { loadConfig, BRAND } from "@planet/config";
import type { RealtimeMessage } from "@planet/shared-types";
import { authRoutes } from "./routes/auth.js";
import { planetRoutes } from "./routes/planet.js";
import { contributionRoutes } from "./routes/contributions.js";
import { adminRoutes } from "./routes/admin.js";
import { pool } from "./db/client.js";

const config = loadConfig();

declare module "fastify" {
  interface FastifyInstance {
    broadcast?: (msg: RealtimeMessage) => void;
  }
}

async function main() {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
  });

  await app.register(cors, {
    origin: [config.APP_URL, config.ADMIN_URL, "http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });
  await app.register(jwt, { secret: config.JWT_SECRET });

  await app.register(swagger, {
    openapi: {
      info: {
        title: `${BRAND.nameEn} API`,
        description: `${BRAND.nameAr} — ${BRAND.taglineAr}`,
        version: "0.1.0",
      },
      servers: [{ url: config.API_URL }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return {
      ok: true,
      service: "api",
      brand: BRAND.nameAr,
      aiProvider: config.AI_PROVIDER,
      sandbox: config.AI_SANDBOX_MODE,
    };
  });

  await app.register(authRoutes, { prefix: "/v1" });
  await app.register(planetRoutes, { prefix: "/v1" });
  await app.register(contributionRoutes, { prefix: "/v1" });
  await app.register(adminRoutes, { prefix: "/v1" });

  await app.ready();

  const httpServer = createServer(app.server as unknown as never);
  // Use Fastify's underlying server
  const io = new SocketServer(app.server, {
    cors: {
      origin: [config.APP_URL, config.ADMIN_URL, "http://localhost:3000"],
      credentials: true,
    },
    path: "/ws",
  });

  io.on("connection", (socket) => {
    socket.join("world");
    socket.emit("realtime", {
      channel: "world.events",
      type: "connected",
      payload: { message: "connected", messageAr: "تم الاتصال" },
      ts: new Date().toISOString(),
    } satisfies RealtimeMessage);

    socket.on("subscribe", (channel: string) => {
      socket.join(channel);
    });
  });

  app.broadcast = (msg: RealtimeMessage) => {
    io.to("world").emit("realtime", msg);
    if (msg.channel) io.to(msg.channel).emit("realtime", msg);
  };

  // Auto-tick every 60s in development when planet running
  if (config.NODE_ENV !== "test") {
    setInterval(async () => {
      try {
        const { getPrimaryPlanet, runTicks } = await import("./services/world-service.js");
        const planet = await getPrimaryPlanet();
        if (!planet || planet.status !== "running") return;
        const result = await runTicks(planet.id, 1);
        app.broadcast?.({
          channel: "world.tick",
          type: "tick.auto",
          payload: {
            tick: result.state.tick,
            year: result.state.year,
            events: result.newEvents.filter((e) => e.type !== "TICK_COMPLETED").slice(0, 5),
          },
          ts: new Date().toISOString(),
          planetId: planet.id,
        });
      } catch (err) {
        app.log.warn({ err }, "auto-tick failed");
      }
    }, 60_000);
  }

  const port = Number(new URL(config.API_URL).port || 4000);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`${BRAND.nameAr} API on ${config.API_URL}`);
  app.log.info(`OpenAPI docs: ${config.API_URL}/docs`);
  void httpServer;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
