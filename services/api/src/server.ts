
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@kawkab/config";
import { parseAndBalanceContribution } from "@kawkab/ai-orchestrator";
import { ContributionInputSchema } from "@kawkab/validation";
import { applyContribution, compareSnapshots, runFutureScenarios, runTick, SimulationEngine, snapshot } from "@kawkab/simulation-engine";
import { UserContributionSchema, UserSchema, type Notification, type SimulationState, type UserContribution, type WorldEvent } from "@kawkab/shared-types";
import { migrate, sqlite } from "./db/index";
import { DEFAULT_DEMO_SEED, ensureDemoWorld, listTimeline, notificationId, persistEvents, persistSnapshot, persistState, snapshotAtOrBefore } from "./world-store";

interface JwtUser {
  sub: string;
  email: string;
  roles: string[];
  refreshVersion?: number;
}

const env = loadEnv();
migrate();
const initialState = ensureDemoWorld(env.SIMULATION_SEED || DEFAULT_DEMO_SEED);
const engine = new SimulationEngine({ seed: initialState.planet.seed, resolution: Math.round(Math.sqrt(initialState.planet.regions.length)) }, initialState);
let simulationPaused = false;

function publicUser(row: any) {
  const contributionCount = sqlite.prepare("SELECT COUNT(*) AS count FROM contributions WHERE user_id = ? AND status = 'applied'").get(row.id) as { count: number } | undefined;
  return UserSchema.parse({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    roles: JSON.parse(row.roles),
    createdAt: row.created_at,
    contributionScore: Number(contributionCount?.count ?? 0)
  });
}

async function requireAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

function requireRole(roles: string[]) {
  return async (request: any, reply: any) => {
    await requireAuth(request, reply);
    const user = authUser(request);
    if (!user?.roles?.some((role) => roles.includes(role))) return reply.code(403).send({ error: "forbidden", requiredRoles: roles });
  };
}

function authUser(request: { user?: unknown }): JwtUser {
  return request.user as JwtUser;
}

function tokensFor(user: { id: string; email: string; roles: string[]; refreshTokenVersion: number }) {
  return {
    accessToken: app.jwt.sign({ sub: user.id, email: user.email, roles: user.roles }, { expiresIn: "15m" }),
    refreshToken: app.jwt.sign({ sub: user.id, email: user.email, roles: user.roles, refreshVersion: user.refreshTokenVersion }, { expiresIn: "30d" })
  };
}

function contributionFromRow(row: any): UserContribution {
  return UserContributionSchema.parse(JSON.parse(row.payload));
}

function loadContribution(id: string): UserContribution | undefined {
  const row = sqlite.prepare("SELECT payload FROM contributions WHERE id = ?").get(id) as { payload: string } | undefined;
  return row ? UserContributionSchema.parse(JSON.parse(row.payload)) : undefined;
}

function saveContribution(contribution: UserContribution): void {
  sqlite
    .prepare("INSERT OR REPLACE INTO contributions (id, user_id, planet_id, category, prompt, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(contribution.id, contribution.userId, contribution.planetId, contribution.category, contribution.prompt, JSON.stringify(contribution), contribution.status, contribution.createdAt);
}

async function broadcast(topic: string, payload: unknown): Promise<boolean> {
  const url = process.env.REALTIME_INTERNAL_URL ?? "http://localhost:4010/broadcast";
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, payload }) });
    return response.ok;
  } catch (error) {
    app.log.warn({ error }, "realtime broadcast failed");
    return false;
  }
}

function createNotifications(userId: string, planetId: string, events: WorldEvent[]): Notification[] {
  const created: Notification[] = events.map((event) => ({
    id: notificationId(userId, event.id),
    userId,
    planetId,
    eventId: event.id,
    title: "أثر مساهمتك ظهر في العالم",
    body: `${event.title}: ${event.description}`,
    read: false,
    createdAt: new Date().toISOString()
  }));
  const stmt = sqlite.prepare("INSERT OR IGNORE INTO notifications (id, user_id, planet_id, event_id, title, body, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const tx = sqlite.transaction((items: Notification[]) => {
    for (const item of items) stmt.run(item.id, item.userId, item.planetId, item.eventId, item.title, item.body, item.read ? 1 : 0, item.createdAt);
  });
  tx(created);
  return created;
}

function previewContribution(contribution: UserContribution) {
  const before = engine.state;
  const applied = applyContribution(before, contribution);
  let previewState: SimulationState = applied.state;
  for (let i = 0; i < 6; i += 1) previewState = runTick(previewState);
  const comparison = compareSnapshots(before, previewState);
  const scenarios = runFutureScenarios(previewState, 8, 4);
  const uncertaintyNorm = Math.min(0.5, scenarios.uncertainty / Math.max(1, scenarios.best.score));
  const successProbability = Number(Math.max(0.05, Math.min(0.95, 0.72 - uncertaintyNorm + (contribution.status === "rejected" ? -0.35 : 0))).toFixed(2));
  const suitableBiomes = Array.from(new Set(previewState.planet.regions.filter((region) => region.populationCapacity > 100).slice(0, 20).map((region) => region.biome)));
  const risks = [
    scenarios.worst.wars > scenarios.mostLikely.wars ? "war-escalation" : undefined,
    comparison.averagePollutionDelta > 0.01 ? "pollution-rise" : undefined,
    comparison.populationDelta < 0 ? "population-loss" : undefined
  ].filter(Boolean);
  return { contribution, appliedEvents: applied.events, previewEvents: previewState.events.slice(before.events.length), deltas: comparison, risks, successProbability, suitableBiomes, scenarios };
}

export const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(swagger, { openapi: { info: { title: "Kawkab API", version: "0.2.0" } } });
await app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/health", async () => ({ ok: true, service: "api", database: env.DATABASE_URL ? "postgres-configured" : "sqlite-local", tick: engine.state.tick, planetId: engine.state.planet.id }));

app.post("/auth/register", async (request, reply) => {
  const body = request.body as { email?: string; password?: string; displayName?: string };
  if (!body.email || !body.password || body.password.length < 8) return reply.code(400).send({ error: "email and password(8+) required" });
  const id = randomUUID();
  const now = new Date().toISOString();
  try {
    sqlite.prepare("INSERT INTO users (id, email, password_hash, display_name, roles, refresh_token_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      id,
      body.email,
      await bcrypt.hash(body.password, 10),
      body.displayName ?? body.email.split("@")[0],
      JSON.stringify(["creator"]),
      0,
      now
    );
  } catch {
    return reply.code(409).send({ error: "email already registered" });
  }
  const row: any = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(id);
  const tokenPayload = { id: row.id, email: row.email, roles: JSON.parse(row.roles), refreshTokenVersion: row.refresh_token_version };
  return { user: publicUser(row), ...tokensFor(tokenPayload) };
});

app.post("/auth/login", async (request, reply) => {
  const body = request.body as { email?: string; password?: string; refreshToken?: string };
  if (body.refreshToken) {
    const decoded = app.jwt.verify<JwtUser>(body.refreshToken);
    const row: any = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(decoded.sub);
    if (!row || row.refresh_token_version !== decoded.refreshVersion) return reply.code(401).send({ error: "refresh token revoked" });
    sqlite.prepare("UPDATE users SET refresh_token_version = refresh_token_version + 1 WHERE id = ?").run(row.id);
    const updated: any = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(row.id);
    return { user: publicUser(updated), ...tokensFor({ id: updated.id, email: updated.email, roles: JSON.parse(updated.roles), refreshTokenVersion: updated.refresh_token_version }) };
  }
  if (!body.email || !body.password) return reply.code(400).send({ error: "email and password required" });
  const row: any = sqlite.prepare("SELECT * FROM users WHERE email = ?").get(body.email);
  if (!row || !(await bcrypt.compare(body.password, row.password_hash))) return reply.code(401).send({ error: "invalid credentials" });
  sqlite.prepare("UPDATE users SET refresh_token_version = refresh_token_version + 1 WHERE id = ?").run(row.id);
  const updated: any = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(row.id);
  return { user: publicUser(updated), ...tokensFor({ id: updated.id, email: updated.email, roles: JSON.parse(updated.roles), refreshTokenVersion: updated.refresh_token_version }) };
});

app.get("/users/me", { preHandler: requireAuth }, async (request) => {
  const user = authUser(request);
  const row: any = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(user.sub);
  return { user: row ? publicUser(row) : null };
});

app.get("/notifications", { preHandler: requireAuth }, async (request) => {
  const user = authUser(request);
  const rows = sqlite.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(user.sub) as any[];
  return { notifications: rows.map((row) => ({ id: row.id, userId: row.user_id, planetId: row.planet_id, eventId: row.event_id, title: row.title, body: row.body, read: Boolean(row.read), createdAt: row.created_at })) };
});

app.get("/planets/:id", async () => ({ planet: engine.state.planet, snapshot: snapshot(engine.state), civilizations: Object.values(engine.state.civilizations), cities: Object.values(engine.state.cities), technologies: Object.values(engine.state.technologies), counts: { civilizations: Object.keys(engine.state.civilizations).length, cities: Object.keys(engine.state.cities).length, species: Object.keys(engine.state.species).length, plants: Object.keys(engine.state.plants).length, resources: Object.keys(engine.state.resources).length, technologies: Object.keys(engine.state.technologies).length } }));
app.get("/planets/:id/regions", async () => ({ regions: engine.state.planet.regions }));
app.get("/planets/:id/regions/:regionId", async (request, reply) => {
  const { regionId } = request.params as { regionId: string };
  const region = engine.state.planet.regions.find((candidate) => candidate.id === regionId);
  if (!region) return reply.code(404).send({ error: "region not found" });
  return { region, species: Object.values(engine.state.species).filter((species) => species.regionId === regionId), plants: Object.values(engine.state.plants).filter((plant) => plant.regionId === regionId), cities: Object.values(engine.state.cities).filter((city) => city.regionId === regionId) };
});
app.get("/planets/:id/events", async () => ({ events: engine.state.events }));
app.get("/planets/:id/timeline", async () => ({ snapshots: listTimeline(engine.state.planet.id), current: snapshot(engine.state) }));
app.get("/planets/:id/causal-graph", async () => ({ nodes: engine.state.events.map((event) => ({ id: event.id, type: event.type, tick: event.tick, title: event.title })), edges: engine.state.causalLinks }));
app.get("/planets/:id/compare", async (request, reply) => {
  const query = request.query as { beforeTick?: string; afterTick?: string; contributionId?: string };
  if (query.contributionId) {
    const contribution = loadContribution(query.contributionId);
    const comparison = (contribution?.structuredPayload as any)?.comparison;
    if (!comparison) return reply.code(404).send({ error: "comparison not found for contribution" });
    return { comparison };
  }
  const before = snapshotAtOrBefore(engine.state.planet.id, Number(query.beforeTick ?? 0));
  const after = snapshotAtOrBefore(engine.state.planet.id, Number(query.afterTick ?? engine.state.tick)) ?? snapshot(engine.state);
  if (!before) return reply.code(404).send({ error: "before snapshot not found" });
  return { comparison: compareSnapshots(before, after), before, after };
});

app.post("/contributions", { preHandler: requireAuth }, async (request) => {
  const user = authUser(request);
  const parsed = ContributionInputSchema.parse({ ...(request.body as object), userId: user.sub });
  const ai = await parseAndBalanceContribution({ prompt: parsed.prompt, planetId: parsed.planetId, userId: user.sub, locale: parsed.locale });
  const contribution = UserContributionSchema.parse({
    id: randomUUID(),
    userId: user.sub,
    planetId: parsed.planetId,
    category: parsed.category ?? ai.category,
    prompt: parsed.prompt,
    structuredPayload: { ...ai, targetRegionId: parsed.targetRegionId, locale: parsed.locale },
    status: ai.accepted ? "previewed" : "rejected",
    balanceNotes: ai.balanceNotes,
    previewEventIds: [],
    confirmedEventIds: [],
    createdAt: new Date().toISOString()
  });
  saveContribution(contribution);
  await broadcast("contribution.status", { contributionId: contribution.id, status: contribution.status });
  return { contribution };
});

app.get("/contributions/:id/preview", { preHandler: requireAuth }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const contribution = loadContribution(id);
  if (!contribution) return reply.code(404).send({ error: "contribution not found" });
  const preview = previewContribution(contribution);
  const updated = UserContributionSchema.parse({ ...contribution, previewEventIds: preview.appliedEvents.map((event) => event.id), structuredPayload: { ...contribution.structuredPayload, preview: { deltas: preview.deltas, risks: preview.risks, successProbability: preview.successProbability, suitableBiomes: preview.suitableBiomes, scenarios: preview.scenarios } } });
  saveContribution(updated);
  return preview;
});

app.post("/contributions/:id/confirm", { preHandler: requireAuth }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const contribution = loadContribution(id);
  if (!contribution) return reply.code(404).send({ error: "contribution not found" });
  if (contribution.status === "rejected") return reply.code(409).send({ error: "rejected contribution cannot be confirmed" });
  const before = engine.state;
  const beforeSnap = persistSnapshot(before);
  const result = engine.applyContribution(contribution);
  const after = result.state;
  const afterSnap = persistSnapshot(after);
  persistState(after, result.events);
  const comparison = compareSnapshots(before, after);
  const updated = UserContributionSchema.parse({ ...contribution, status: "applied", confirmedEventIds: result.events.map((event) => event.id), structuredPayload: { ...contribution.structuredPayload, beforeTick: before.tick, afterTick: after.tick, comparison } });
  saveContribution(updated);
  const notifications = createNotifications(contribution.userId, contribution.planetId, result.events);
  await Promise.all([
    ...result.events.map((event) => broadcast("world.event", event)),
    broadcast("contribution.status", { contributionId: contribution.id, status: "applied" }),
    ...notifications.map((notification) => broadcast("notification.created", notification))
  ]);
  return { contribution: updated, events: result.events, notifications, comparison, before: beforeSnap, after: afterSnap };
});

app.post("/simulation/tick", async () => {
  if (simulationPaused) return { paused: true, state: engine.state, snapshot: snapshot(engine.state) };
  const beforeCount = engine.state.events.length;
  const next = engine.tick();
  const newEvents = next.events.slice(beforeCount);
  persistState(next, newEvents);
  await Promise.all([broadcast("simulation.tick", { tick: next.tick, newEvents: newEvents.length }), ...newEvents.map((event) => broadcast("world.event", event))]);
  return { state: next, snapshot: snapshot(next), events: newEvents };
});
app.get("/simulation/status", async () => ({ tick: engine.state.tick, ageYears: engine.state.planet.ageYears, running: !simulationPaused, paused: simulationPaused }));
app.post("/simulation/scenarios", async (request) => {
  const body = request.body as { years?: number; runs?: number };
  return runFutureScenarios(engine.state, Math.min(100, Math.max(1, Number(body.years ?? 25))), Math.min(32, Math.max(2, Number(body.runs ?? 8))));
});

app.get("/admin/users", { preHandler: requireRole(["admin", "super_admin", "moderator"]) }, async () => {
  const rows = sqlite.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 200").all() as any[];
  return { users: rows.map(publicUser) };
});
app.get("/admin/contributions", { preHandler: requireRole(["admin", "super_admin", "moderator"]) }, async () => {
  const rows = sqlite.prepare("SELECT * FROM contributions ORDER BY created_at DESC LIMIT 200").all() as any[];
  return { contributions: rows.map(contributionFromRow) };
});
app.post("/admin/contributions/:id/moderate", { preHandler: requireRole(["admin", "super_admin", "moderator"]) }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { status?: "previewed" | "rejected" | "confirmed" };
  const contribution = loadContribution(id);
  if (!contribution) return reply.code(404).send({ error: "contribution not found" });
  const updated = UserContributionSchema.parse({ ...contribution, status: body.status === "rejected" ? "rejected" : "previewed", balanceNotes: [...contribution.balanceNotes, `moderated:${body.status ?? "previewed"}`] });
  saveContribution(updated);
  await broadcast("contribution.status", { contributionId: id, status: updated.status });
  return { contribution: updated };
});
app.post("/admin/simulation/tick", { preHandler: requireRole(["admin", "super_admin", "moderator"]) }, async () => app.inject({ method: "POST", url: "/simulation/tick" }).then((res) => JSON.parse(res.payload)));
app.post("/admin/simulation/pause", { preHandler: requireRole(["admin", "super_admin", "moderator"]) }, async () => {
  simulationPaused = true;
  return { paused: true };
});
app.post("/admin/simulation/resume", { preHandler: requireRole(["admin", "super_admin", "moderator"]) }, async () => {
  simulationPaused = false;
  return { paused: false };
});

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen({ port: env.API_PORT, host: "0.0.0.0" }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
