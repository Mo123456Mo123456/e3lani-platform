import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { compare } from "bcryptjs";
import bcrypt from "bcryptjs";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";
import {
  analyzeContributionSchema,
  confirmContributionSchema,
  inspectUserText,
  loginSchema,
  previewContributionSchema,
  registerSchema,
} from "@living-planet/validation";
import type { AnalyzedContribution, RealtimeDelta } from "@living-planet/shared-types";
import { introduceContribution, previewContribution, runTick } from "@living-planet/simulation-engine";
import {
  authenticate,
  issueRefreshToken,
  loadUser,
  requireRole,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  type RequestUser,
} from "./auth.js";
import { checkDatabase, closeDatabase, getDatabase } from "./database.js";
import { migrate } from "./migrate.js";
import { closeEventBus, publishDelta } from "./event-bus.js";
import {
  compareTimeline,
  getBootstrap,
  getCausalGraph,
  loadSimulationState,
  persistContribution,
  persistTick,
  rollbackPlanet,
} from "./world.js";

const DEFAULT_PLANET_ID = "00000000-0000-4000-8000-000000000001";
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const adminOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";
const secureCookies = process.env.NODE_ENV === "production";

interface SocketLike {
  readyState: number;
  send(data: string): void;
}

const clients = new Set<SocketLike>();
let deltaSequence = 0;

function broadcast(planetId: string, tick: number, kind: RealtimeDelta["kind"], payload: RealtimeDelta["payload"]) {
  const delta: RealtimeDelta = { sequence: ++deltaSequence, planetId, tick, kind, payload };
  const serialized = JSON.stringify(delta);
  for (const client of clients) {
    if (client.readyState === 1) client.send(serialized);
  }
  void publishDelta(delta).catch((error: unknown) => {
    console.error(JSON.stringify({ level: "error", message: "event_bus_publish_failed", error: String(error) }));
  });
}

function refreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie("planet_refresh", token, {
    path: "/v1/auth",
    httpOnly: true,
    secure: secureCookies,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function currentUser(request: FastifyRequest, reply: FastifyReply): Promise<RequestUser | undefined> {
  try {
    return await authenticate(request);
  } catch (error) {
    await reply.code(401).send({ error: "UNAUTHORIZED", message: (error as Error).message });
    return undefined;
  }
}

function assertTrustedOrigin(request: FastifyRequest): void {
  const origin = request.headers.origin;
  if (origin && origin !== webOrigin && origin !== adminOrigin) throw new Error("Untrusted request origin");
}

async function analyzeWithProvider(
  userId: string,
  input: { category: string; idea: string; locale: "ar" | "en" },
): Promise<AnalyzedContribution> {
  const started = performance.now();
  const endpoint = `${process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:8000"}/v1/analyze`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const output = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`AI analysis failed: ${JSON.stringify(output)}`);
  const provider = String(output.provider ?? "unknown");
  const sql = getDatabase();
  await sql`
    INSERT INTO ai_requests (
      user_id, provider, purpose, input_hash, output, sandbox, status, latency_ms
    ) VALUES (
      ${userId}, ${provider}, 'contribution_analysis',
      ${createHash("sha256").update(input.idea).digest("hex")},
      ${sql.json(output)}, ${Boolean(output.sandbox)}, 'completed',
      ${Math.round(performance.now() - started)}
    )
  `;
  return output as unknown as AnalyzedContribution;
}

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "req.headers.cookie", "password", "token"],
    },
    trustProxy: true,
    bodyLimit: 64 * 1024,
    requestIdHeader: "x-request-id",
  });
  const metricsRegistry = new Registry();
  collectDefaultMetrics({ register: metricsRegistry, prefix: "living_planet_" });
  const requestDuration = new Histogram({
    name: "living_planet_http_request_duration_seconds",
    help: "API request duration in seconds",
    labelNames: ["method", "route", "status"],
    registers: [metricsRegistry],
  });
  const simulationEvents = new Counter({
    name: "living_planet_simulation_events_total",
    help: "Number of committed simulation events",
    labelNames: ["type"],
    registers: [metricsRegistry],
  });

  await app.register(cors, { origin: [webOrigin, adminOrigin], credentials: true });
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", webOrigin],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "كوكب يولد أمامك API",
        description: "Deterministic living-world API. Simulation results originate in the causal engine.",
        version: "0.1.0",
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(websocket);

  app.get("/health", async (_request, reply) => {
    try {
      const database = await checkDatabase();
      return { status: "ok", database, simulation: "ready", timestamp: new Date().toISOString() };
    } catch (error) {
      return reply.code(503).send({ status: "degraded", database: "unavailable", message: (error as Error).message });
    }
  });
  app.get("/metrics", async (_request, reply) => {
    reply.header("content-type", metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({
      sequence: deltaSequence,
      planetId: DEFAULT_PLANET_ID,
      tick: 0,
      kind: "simulation.status",
      payload: { connected: true, deltaProtocol: 1 },
    } satisfies RealtimeDelta));
    socket.on("close", () => clients.delete(socket));
  });

  app.post("/v1/auth/register", { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } }, async (request, reply) => {
    assertTrustedOrigin(request);
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    const sql = getDatabase();
    const id = randomUUID();
    try {
      await sql.begin(async (transaction) => {
        await transaction`
          INSERT INTO users (id, email, password_hash, display_name)
          VALUES (${id}, ${parsed.data.email.toLowerCase()}, ${await bcrypt.hash(parsed.data.password, 12)}, ${parsed.data.displayName})
        `;
        await transaction`INSERT INTO profiles (user_id) VALUES (${id})`;
        await transaction`
          INSERT INTO user_roles (user_id, role_id)
          SELECT ${id}, id FROM roles WHERE name = 'user'
        `;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "EMAIL_EXISTS" });
      }
      throw error;
    }
    const user = await loadUser(id);
    const token = await issueRefreshToken(id);
    refreshCookie(reply, token);
    return reply.code(201).send({ user, accessToken: await signAccessToken(user) });
  });

  app.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    assertTrustedOrigin(request);
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR" });
    const rows = await getDatabase()<{
      id: string;
      password_hash: string | null;
      status: string;
    }[]>`
      SELECT id, password_hash, status FROM users WHERE email = ${parsed.data.email.toLowerCase()}
    `;
    const row = rows[0];
    if (!row?.password_hash || row.status !== "active" || !(await compare(parsed.data.password, row.password_hash))) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    const user = await loadUser(row.id);
    refreshCookie(reply, await issueRefreshToken(row.id));
    return { user, accessToken: await signAccessToken(user) };
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    assertTrustedOrigin(request);
    const token = request.cookies.planet_refresh;
    if (!token) return reply.code(401).send({ error: "REFRESH_REQUIRED" });
    try {
      const rotated = await rotateRefreshToken(token);
      refreshCookie(reply, rotated.token);
      return { user: rotated.user, accessToken: await signAccessToken(rotated.user) };
    } catch (error) {
      reply.clearCookie("planet_refresh", { path: "/v1/auth" });
      return reply.code(401).send({ error: "INVALID_REFRESH", message: (error as Error).message });
    }
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    assertTrustedOrigin(request);
    const token = request.cookies.planet_refresh;
    if (token) await revokeRefreshToken(token);
    reply.clearCookie("planet_refresh", { path: "/v1/auth" });
    return reply.code(204).send();
  });

  app.get("/v1/planets/:planetId/bootstrap", async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    try {
      return await getBootstrap(planetId);
    } catch (error) {
      return reply.code(404).send({ error: "WORLD_NOT_FOUND", message: (error as Error).message });
    }
  });

  app.get("/v1/contributions/:id/causes", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getCausalGraph(id);
    } catch (error) {
      return reply.code(404).send({ error: "HISTORY_NOT_FOUND", message: (error as Error).message });
    }
  });

  app.post("/v1/contributions/analyze", { config: { rateLimit: { max: 12, timeWindow: "1 hour" } } }, async (request, reply) => {
    const user = await currentUser(request, reply);
    if (!user) return;
    const parsed = analyzeContributionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    const moderation = inspectUserText(parsed.data.idea);
    if (!moderation.safe) {
      return reply.code(422).send({ error: "MODERATION_BLOCK", reasons: moderation.reasons });
    }
    try {
      return await analyzeWithProvider(user.id, parsed.data);
    } catch (error) {
      request.log.error({ error }, "AI orchestrator failed");
      return reply.code(503).send({
        error: "AI_PROVIDER_UNAVAILABLE",
        message: (error as Error).message,
        fallbackUsed: false,
      });
    }
  });

  app.post("/v1/contributions/preview", async (request, reply) => {
    const user = await currentUser(request, reply);
    if (!user) return;
    const parsed = previewContributionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    try {
      const state = await loadSimulationState(parsed.data.planetId);
      return previewContribution(state, parsed.data.contribution, parsed.data.regionId);
    } catch (error) {
      return reply.code(422).send({ error: "PREVIEW_FAILED", message: (error as Error).message });
    }
  });

  app.post("/v1/contributions", async (request, reply) => {
    const user = await currentUser(request, reply);
    if (!user) return;
    const parsed = confirmContributionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    const moderation = inspectUserText(parsed.data.originalIdea);
    if (!moderation.safe) return reply.code(422).send({ error: "MODERATION_BLOCK", reasons: moderation.reasons });
    const contributionId = randomUUID();
    try {
      const state = await loadSimulationState(parsed.data.planetId);
      const result = introduceContribution(
        state,
        parsed.data.contribution,
        parsed.data.regionId,
        contributionId,
      );
      const persisted = await persistContribution({
        id: contributionId,
        userId: user.id,
        planetId: parsed.data.planetId,
        regionId: parsed.data.regionId,
        originalIdea: parsed.data.originalIdea,
        idempotencyKey: parsed.data.idempotencyKey,
        contribution: parsed.data.contribution,
        result,
      });
      broadcast(parsed.data.planetId, persisted.event.tick, "event.created", persisted.event);
      return reply.code(persisted.existing ? 200 : 201).send({
        contributionId: persisted.event.contributionId,
        event: persisted.event,
        idempotentReplay: persisted.existing,
      });
    } catch (error) {
      return reply.code(409).send({ error: "CONTRIBUTION_FAILED", message: (error as Error).message });
    }
  });

  app.post("/v1/admin/planets/:planetId/tick", async (request, reply) => {
    const user = await currentUser(request, reply);
    if (!user) return;
    try {
      requireRole(user, "simulation_manager");
      const { planetId } = request.params as { planetId: string };
      const state = await loadSimulationState(planetId);
      const started = performance.now();
      const result = runTick(state);
      await persistTick(result, Math.round(performance.now() - started));
      for (const event of result.events) simulationEvents.inc({ type: event.type });
      for (const event of result.events.filter((item) => item.importance >= 0.6)) {
        broadcast(planetId, result.state.tick, "event.created", event);
      }
      broadcast(planetId, result.state.tick, "simulation.status", {
        status: "committed",
        eventCount: result.events.length,
      });
      return {
        tick: result.state.tick,
        year: result.state.year,
        eventCount: result.events.length,
      };
    } catch (error) {
      return reply.code(403).send({ error: "TICK_FAILED", message: (error as Error).message });
    }
  });

  app.post("/v1/admin/planets/:planetId/rollback/:tick", async (request, reply) => {
    const user = await currentUser(request, reply);
    if (!user) return;
    try {
      requireRole(user, "simulation_manager");
      const { planetId, tick } = request.params as { planetId: string; tick: string };
      await rollbackPlanet(planetId, Number(tick), user.id);
      broadcast(planetId, Number(tick), "simulation.status", { status: "paused", rollback: true });
      return { planetId, tick: Number(tick), status: "paused" };
    } catch (error) {
      return reply.code(403).send({ error: "ROLLBACK_FAILED", message: (error as Error).message });
    }
  });

  app.get("/v1/planets/:planetId/compare", async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const { from, to } = request.query as { from?: string; to?: string };
    try {
      return await compareTimeline(planetId, Number(from), Number(to));
    } catch (error) {
      return reply.code(422).send({ error: "COMPARISON_FAILED", message: (error as Error).message });
    }
  });

  app.get("/v1/admin/overview", async (request, reply) => {
    const user = await currentUser(request, reply);
    if (!user) return;
    try {
      requireRole(user, "admin", "simulation_manager");
      const sql = getDatabase();
      const rows = await sql`
        SELECT
          (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM user_contributions) AS contributions,
          (SELECT count(*) FROM world_events) AS events,
          (SELECT count(*) FROM moderation_results WHERE decision = 'review') AS moderation_queue,
          (SELECT COALESCE(sum(cost_usd), 0) FROM ai_requests) AS ai_cost_usd,
          (SELECT COALESCE(avg(duration_ms), 0) FROM simulation_ticks WHERE status = 'committed') AS avg_tick_ms
      `;
      return rows[0];
    } catch (error) {
      return reply.code(403).send({ error: "FORBIDDEN", message: (error as Error).message });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "request_failed");
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return reply.code(status).send({
      error: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message: status === 500 ? "The request could not be completed" : error.message,
      requestId: request.id,
    });
  });

  app.addHook("onRequest", async (request) => {
    (request as FastifyRequest & { metricsStartedAt?: number }).metricsStartedAt = performance.now();
  });
  app.addHook("onResponse", async (request, reply) => {
    const started = (request as FastifyRequest & { metricsStartedAt?: number }).metricsStartedAt;
    if (started !== undefined) {
      requestDuration.observe(
        {
          method: request.method,
          route: request.routeOptions.url,
          status: String(reply.statusCode),
        },
        (performance.now() - started) / 1000,
      );
    }
  });

  app.addHook("onClose", async () => {
    await Promise.allSettled([closeEventBus(), closeDatabase()]);
  });
  return app;
}

async function start(): Promise<void> {
  if (process.env.AUTO_MIGRATE === "true") await migrate();
  const server = await buildServer();
  const port = Number(process.env.API_PORT ?? 4000);
  await server.listen({ host: "0.0.0.0", port });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
