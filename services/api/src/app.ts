/**
 * buildApp — the Fastify application factory. Everything is wired through an
 * explicit AppContext so tests can inject an in-memory world.
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createTracker, type Tracker } from "@planet/analytics";
import type { ApiEnv } from "@planet/config";
import type { Repository } from "./store/repository.js";
import { TokenService } from "./auth/tokens.js";
import { WorldManager } from "./world/manager.js";
import { AiOrchestrator } from "./ai/orchestrator.js";
import type { AppContext } from "./context.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPlanetRoutes } from "./routes/planets.js";
import { registerContributionRoutes } from "./routes/contributions.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerRealtimeGateway } from "./realtime/gateway.js";

export interface BuildAppOptions {
  env: ApiEnv;
  repository: Repository;
  worlds?: WorldManager;
  tracker?: Tracker;
}

export async function buildApp(options: BuildAppOptions): Promise<{ app: FastifyInstance; ctx: AppContext }> {
  const { env, repository } = options;
  const app = Fastify({
    logger: env.NODE_ENV === "development" ? { level: "info" } : true,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
  });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  if (env.NODE_ENV !== "test") {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "Planet Genesis API — كوكب يولد أمامك",
          description:
            "A living procedural planet: deterministic simulation, causal event sourcing, and AI-assisted user contributions.",
          version: "0.1.0",
        },
        servers: [{ url: `http://localhost:${env.PORT}` }],
      },
    });
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  const tokens = new TokenService(repository, app.jwt, env.ACCESS_TOKEN_TTL_SECONDS, env.REFRESH_TOKEN_TTL_SECONDS);
  const worlds =
    options.worlds ??
    new WorldManager({
      repository,
      yearsPerTick: env.YEARS_PER_TICK,
      snapshotInterval: 25,
    });
  const ai = new AiOrchestrator(
    { url: env.AI_ORCHESTRATOR_URL, provider: env.AI_PROVIDER },
    repository,
  );
  const tracker = options.tracker ?? createTracker();
  const ctx: AppContext = { env, repository, tokens, worlds, ai, tracker };

  app.get("/health", { schema: { tags: ["ops"], summary: "Liveness" } }, async () => ({ status: "ok" }));
  app.get("/ready", { schema: { tags: ["ops"], summary: "Readiness" } }, async () => {
    const planets = await repository.listPlanets();
    return { status: "ready", planets: planets.length };
  });

  registerAuthRoutes(app, ctx);
  registerPlanetRoutes(app, ctx);
  registerContributionRoutes(app, ctx);
  registerMeRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
  registerAnalyticsRoutes(app, ctx);
  registerRealtimeGateway(app, ctx);

  app.addHook("onClose", async () => {
    await worlds.shutdown();
    await repository.close();
  });

  return { app, ctx };
}
