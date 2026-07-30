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
import { SimulationEngine, snapshot } from "@kawkab/simulation-engine";
import { UserContributionSchema, UserSchema } from "@kawkab/shared-types";
import { migrate, sqlite } from "./db/index";

interface JwtUser {
  sub: string;
  email: string;
  roles: string[];
  refreshVersion?: number;
}

const env = loadEnv();
const engine = new SimulationEngine({ seed: env.SIMULATION_SEED, resolution: 18 });
const contributionPreviews = new Map<string, unknown>();

function publicUser(row: any) {
  return UserSchema.parse({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    roles: JSON.parse(row.roles),
    createdAt: row.created_at,
    contributionScore: 0
  });
}

async function requireAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
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

export const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(swagger, {
  openapi: {
    info: { title: "Kawkab API", version: "0.1.0" }
  }
});
await app.register(swaggerUi, { routePrefix: "/docs" });

migrate();

app.get("/health", async () => ({ ok: true, service: "api", database: env.DATABASE_URL ? "postgres-configured" : "sqlite-local", tick: engine.state.tick }));

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

app.get("/planets/:id", async () => ({ planet: engine.state.planet, snapshot: snapshot(engine.state) }));
app.get("/planets/:id/regions/:regionId", async (request, reply) => {
  const { regionId } = request.params as { regionId: string };
  const region = engine.state.planet.regions.find((candidate) => candidate.id === regionId);
  if (!region) return reply.code(404).send({ error: "region not found" });
  return { region };
});
app.get("/planets/:id/events", async () => ({ events: engine.state.events }));
app.get("/planets/:id/timeline", async () => ({ snapshots: engine.snapshots() }));

app.post("/contributions", { preHandler: requireAuth }, async (request) => {
  const user = authUser(request);
  const parsed = ContributionInputSchema.parse({ ...(request.body as object), userId: user.sub });
  const ai = await parseAndBalanceContribution({ prompt: parsed.prompt, planetId: parsed.planetId, userId: user.sub, locale: parsed.locale });
  const contribution = UserContributionSchema.parse({
    id: randomUUID(),
    userId: user.sub,
    planetId: parsed.planetId,
    category: ai.category,
    prompt: parsed.prompt,
    structuredPayload: ai,
    status: ai.accepted ? "previewed" : "rejected",
    balanceNotes: ai.balanceNotes,
    createdAt: new Date().toISOString()
  });
  contributionPreviews.set(contribution.id, contribution);
  sqlite.prepare("INSERT INTO contributions (id, user_id, planet_id, category, prompt, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    contribution.id,
    contribution.userId,
    contribution.planetId,
    contribution.category,
    contribution.prompt,
    JSON.stringify(contribution),
    contribution.status,
    contribution.createdAt
  );
  return { contribution };
});

app.get("/contributions/:id/preview", { preHandler: requireAuth }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const contribution = contributionPreviews.get(id);
  if (!contribution) return reply.code(404).send({ error: "preview not found" });
  return { contribution, status: "غير مفعّل: preview applies after moderation workflow is wired" };
});

app.post("/contributions/:id/confirm", { preHandler: requireAuth }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const contribution = contributionPreviews.get(id) as any;
  if (!contribution) return reply.code(404).send({ error: "preview not found" });
  contribution.status = "confirmed";
  sqlite.prepare("UPDATE contributions SET status = ?, payload = ? WHERE id = ?").run("confirmed", JSON.stringify(contribution), id);
  return { contribution, status: "confirmed" };
});

app.post("/simulation/tick", async () => ({ state: engine.tick(), snapshot: snapshot(engine.state) }));
app.get("/simulation/status", async () => ({ tick: engine.state.tick, ageYears: engine.state.planet.ageYears, running: false, label: "غير مفعّل: automatic scheduler not started in API process" }));

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen({ port: env.API_PORT, host: "0.0.0.0" }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
