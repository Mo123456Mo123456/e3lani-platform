import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import {
  contributionCommitSchema,
  contributionRequestSchema,
  type WorldDelta,
} from "@planet/shared-types";
import { createAnalysisProvider, narrateEvents } from "@planet/ai-orchestrator";
import { forecastContribution } from "@planet/simulation-models";
import Fastify from "fastify";
import { Pool } from "pg";
import type { WebSocket } from "ws";
import { ZodError, z } from "zod";
import { registerAuthRoutes } from "./auth.js";
import { config } from "./config.js";
import { EventBus } from "./event-bus.js";
import { migrate } from "./migrate.js";
import { WorldStore } from "./world-store.js";

const tickRequestSchema = z.object({ count: z.number().int().min(1).max(10).default(1) });
const queryLimitSchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      redact: ["req.headers.authorization", "req.headers.cookie", "body.password"],
    },
    bodyLimit: 256 * 1024,
    trustProxy: config.NODE_ENV === "production",
    requestIdHeader: "x-request-id",
  });
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
  });
  const bus = new EventBus(config.NATS_URL);
  const sockets = new Set<WebSocket>();

  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { iss: "planet-api", aud: "planet-web" },
    verify: { allowedIss: "planet-api", allowedAud: "planet-web" },
  });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "كوكب يولد أمامك API",
        description: "Deterministic world simulation, contributions, and causal history",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:4000" }],
      tags: [
        { name: "auth", description: "Authentication and refresh rotation" },
        { name: "world", description: "World state and deterministic simulation" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  if (config.AUTO_MIGRATE === "true") await migrate(pool);
  await bus.connect(config.NODE_ENV === "production");
  const store = new WorldStore(pool, config.WORLD_SEED);
  await store.ensureWorld();
  const auth = registerAuthRoutes(app, pool, config);
  const provider = createAnalysisProvider(process.env);

  const broadcast = (delta: WorldDelta | undefined) => {
    if (!delta) return;
    const message = JSON.stringify({ type: "world.delta", payload: delta });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
    bus.publishDelta(delta);
    bus.publishEvents(delta.events);
  };

  app.get("/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", database: "connected", simulation: "ready" };
    } catch {
      return reply.code(503).send({ status: "degraded", database: "unavailable" });
    }
  });

  app.get("/v1/world", { schema: { tags: ["world"] } }, async () => store.getOverview());

  app.get("/v1/world/regions/:id", { schema: { tags: ["world"] } }, async (request, reply) => {
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const state = await store.ensureWorld();
    const region = state.regions.find((item) => item.id === id);
    if (!region) return reply.code(404).send({ code: "REGION_NOT_FOUND" });
    return {
      region,
      civilizations: state.civilizations.filter((item) => item.regionId === id),
      species: state.species.filter((item) => item.regionId === id).slice(0, 30),
    };
  });

  app.get("/v1/world/events", { schema: { tags: ["world"] } }, async (request) => {
    const { limit } = queryLimitSchema.parse(request.query);
    return { events: await store.events(limit) };
  });

  app.get("/v1/world/events/:id/causes", { schema: { tags: ["world"] } }, async (request) => {
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    return { links: await store.causalGraph(id) };
  });

  app.get("/v1/world/timeline", { schema: { tags: ["world"] } }, async () => {
    const state = await store.ensureWorld();
    const result = await pool.query(
      `SELECT version,tick,year,state_hash,created_at FROM timeline_snapshots
       WHERE planet_id=$1 ORDER BY version DESC LIMIT 200`,
      [state.planetId],
    );
    return { snapshots: result.rows };
  });

  app.get("/v1/world/compare", { schema: { tags: ["world"] } }, async (request, reply) => {
    const query = z
      .object({
        fromVersion: z.coerce.number().int().positive(),
        toVersion: z.coerce.number().int().positive(),
      })
      .parse(request.query);
    const state = await store.ensureWorld();
    const snapshots = await pool.query<{ version: string; state: typeof state }>(
      `SELECT version,state FROM timeline_snapshots
       WHERE planet_id=$1 AND version=ANY($2::bigint[])`,
      [state.planetId, [query.fromVersion, query.toVersion]],
    );
    if (snapshots.rows.length !== 2) {
      return reply.code(404).send({ code: "SNAPSHOT_NOT_FOUND" });
    }
    const from = snapshots.rows.find((item) => Number(item.version) === query.fromVersion)!.state;
    const to = snapshots.rows.find((item) => Number(item.version) === query.toVersion)!.state;
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    return {
      from: { version: from.version, tick: from.tick, year: from.year },
      to: { version: to.version, tick: to.tick, year: to.year },
      changes: {
        population:
          sum(to.civilizations.map((item) => item.population)) -
          sum(from.civilizations.map((item) => item.population)),
        meanTemperature:
          sum(to.regions.map((item) => item.temperature)) / to.regions.length -
          sum(from.regions.map((item) => item.temperature)) / from.regions.length,
        vegetation:
          sum(to.regions.map((item) => item.vegetation)) -
          sum(from.regions.map((item) => item.vegetation)),
        pollution:
          sum(to.regions.map((item) => item.pollution)) -
          sum(from.regions.map((item) => item.pollution)),
      },
    };
  });

  app.post(
    "/v1/contributions/analyze",
    {
      preHandler: auth.authenticate,
      config: { rateLimit: { max: 12, timeWindow: "1 hour" } },
      schema: { tags: ["world"] },
    },
    async (request) => {
      const started = performance.now();
      const input = contributionRequestSchema.parse(request.body);
      const analysis = await provider.analyze(input);
      const state = await store.ensureWorld();
      const regions = state.regions
        .filter((region) => analysis.possibleBiomes.includes(region.biome))
        .sort(
          (left, right) =>
            right.fertility + right.surfaceWater - (left.fertility + left.surfaceWater),
        )
        .slice(0, 12);
      const region = regions[0] ?? state.regions.find((item) => item.biome !== "ocean")!;
      const scenarios = forecastContribution(state, analysis, region);
      await pool.query(
        `INSERT INTO ai_requests(
           user_id,provider,model,purpose,input_hash,output,status,latency_ms
         ) VALUES ($1,$2,$3,'contribution_analysis',$4,$5,'completed',$6)`,
        [
          auth.claims(request).sub,
          analysis.provider,
          analysis.model,
          createHash("sha256").update(input.idea).digest("hex"),
          JSON.stringify({ analysis, scenarios }),
          Math.round(performance.now() - started),
        ],
      );
      return {
        analysis,
        suggestedRegions: regions,
        scenarios,
        sandbox: analysis.provider === "sandbox-rule-engine",
      };
    },
  );

  app.post(
    "/v1/contributions",
    { preHandler: auth.authenticate, schema: { tags: ["world"] } },
    async (request, reply) => {
      const input = contributionCommitSchema.parse(request.body);
      try {
        const result = await store.addContribution({
          userId: auth.claims(request).sub,
          analysis: input.analysis,
          regionId: input.regionId,
          expectedVersion: input.expectedVersion,
        });
        broadcast(result.delta);
        return reply.code(201).send({
          contributionId: result.contributionId,
          stateVersion: result.state.version,
          events: result.events,
          narrative: narrateEvents(result.events, "ar"),
        });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          return reply.code(409).send({ code: "ONE_CONTRIBUTION_PER_WORLD" });
        }
        throw error;
      }
    },
  );

  app.post(
    "/v1/world/ticks",
    { preHandler: auth.authenticate, schema: { tags: ["world"] } },
    async (request) => {
      const { count } = tickRequestSchema.parse(request.body);
      const result = await store.runTicks(count);
      broadcast(result.delta);
      return {
        tick: result.state.tick,
        year: result.state.year,
        version: result.state.version,
        events: result.events,
      };
    },
  );

  app.get(
    "/v1/notifications",
    { preHandler: auth.authenticate },
    async (request) => {
      const result = await pool.query(
        `SELECT id,type,title,body,world_event_id,read_at,created_at
         FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [auth.claims(request).sub],
      );
      return { notifications: result.rows };
    },
  );

  app.get("/v1/admin/status", { preHandler: auth.authenticate }, async (request, reply) => {
    const claims = auth.claims(request);
    if (!claims.roles.some((role) => ["simulation_manager", "system_admin", "super_admin"].includes(role))) {
      return reply.code(403).send({ code: "FORBIDDEN" });
    }
    const [world, queue, ai] = await Promise.all([
      store.getOverview(),
      pool.query("SELECT count(*) AS pending FROM moderation_results WHERE decision='NEEDS_REVIEW'"),
      pool.query(
        `SELECT provider,count(*) AS requests,coalesce(sum(cost_usd),0) AS cost
         FROM ai_requests GROUP BY provider`,
      ),
    ]);
    return {
      simulation: {
        status: world.simulationStatus,
        tick: world.state.tick,
        version: world.state.version,
      },
      moderation: queue.rows[0],
      ai: ai.rows,
    };
  });

  app.route({
    method: "GET",
    url: "/v1/realtime",
    websocket: true,
    handler: async (socket, request) => {
      const query = z.object({ token: z.string().min(20) }).safeParse(request.query);
      if (!query.success) return socket.close(1008, "Authentication required");
      try {
        await app.jwt.verify(query.data.token);
      } catch {
        return socket.close(1008, "Invalid token");
      }
      sockets.add(socket);
      socket.send(JSON.stringify({ type: "realtime.ready", payload: { deltaUpdates: true } }));
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => sockets.delete(socket));
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    }
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    request.log.error({ err: error }, "request failed");
    return reply
      .code(statusCode)
      .send({ code: statusCode === 500 ? "INTERNAL_ERROR" : error.message });
  });

  app.addHook("onClose", async () => {
    for (const socket of sockets) socket.close(1001, "Server shutting down");
    await bus.close();
    await pool.end();
  });

  return app;
}

async function main() {
  const app = await buildServer();
  const close = async () => {
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  await app.listen({ host: config.HOST, port: config.PORT });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
