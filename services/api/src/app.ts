import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jwtVerify, SignJWT } from "jose";
import {
  applyContribution,
  runFutureScenarios,
  stepSimulation,
} from "@planet-born/simulation-models";
import {
  AnalyzeContributionRequestSchema,
  AuthLoginSchema,
  AuthRegisterSchema,
  ConfirmContributionRequestSchema,
  FutureScenarioRequestSchema,
  StructuredContributionSchema,
  SimulationTickRequestSchema,
  type StructuredContribution,
} from "@planet-born/shared-types";
import { moderateContributionIdea } from "@planet-born/validation";
import { z } from "zod";
import { Repository, type UserRecord } from "./db/repository.js";

const ADMIN_ROLES = new Set(["system_admin", "super_admin"]);
const jwtSecret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "planet-born-development-secret-change-in-production",
);
const refreshDigest = (token: string) =>
  createHash("sha256").update(token).digest("base64url");

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

const publicUser = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  locale: user.locale,
  level: user.level,
  xp: user.xp,
  createdAt: user.createdAt.toISOString(),
});

const categoryFromIdea = (idea: string): StructuredContribution["category"] => {
  if (/نبات|شجر|plant|tree/i.test(idea)) return "plant";
  if (/حيوان|مخلوق|creature|animal/i.test(idea)) return "creature";
  if (/حضار|civilization/i.test(idea)) return "civilization";
  if (/مرض|وباء|disease/i.test(idea)) return "disease";
  if (/مورد|معدن|resource|mineral/i.test(idea)) return "resource";
  if (/كارث|عاصف|disaster|storm/i.test(idea)) return "disaster";
  return "custom";
};

export function localAnalyze(input: {
  idea: string;
  category?: StructuredContribution["category"];
  locale: "ar" | "en";
}): StructuredContribution {
  const category = input.category ?? categoryFromIdea(input.idea);
  const words = input.idea.trim().split(/\s+/).slice(0, 8).join(" ");
  return StructuredContributionSchema.parse({
    category,
    name: words.slice(0, 120),
    description: input.idea,
    traits: {
      adaptability: 0.55,
      environmentalImpact: category === "disaster" ? 0.75 : 0.25,
    },
    possibleBiomes: ["plains", "temperate_forest"],
    risks: category === "disaster" ? ["regional_damage"] : [],
    benefits: category === "disaster" ? [] : ["ecosystem_diversity"],
    wasBalanced: false,
    balanceNotes: [],
  });
}

async function publishRealtime(type: string, planetId: string, payload: unknown) {
  try {
    await fetch(`${process.env.REALTIME_URL ?? "http://localhost:4300"}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, planetId, payload }),
      signal: AbortSignal.timeout(1_500),
    });
  } catch {
    // Realtime is best-effort and must never block simulation progress.
  }
}

export type BuildAppOptions = {
  repository?: Repository;
  seed?: boolean;
  logger?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const repository = options.repository ?? new Repository();
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Planet Born API",
        description: "كوكب يولد أمامك simulation platform API",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  if (options.seed !== false && repository.memoryMode) {
    await repository.seed({
      adminPasswordHash: await bcrypt.hash("PlanetAdmin!2026", 10),
      explorerPasswordHash: await bcrypt.hash("Explorer!2026", 10),
    });
  }

  app.addHook("onClose", async () => repository.close());
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    if (
      (error as { code?: string }).code === "23505" ||
      (error instanceof Error && error.message === "EMAIL_EXISTS")
    ) {
      return reply.code(409).send({ error: "EMAIL_EXISTS" });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR" });
  });

  async function issueTokens(user: UserRecord) {
    const accessToken = await new SignJWT({
      role: user.role,
      email: user.email,
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(process.env.JWT_ACCESS_TTL ?? "15m")
      .sign(jwtSecret);
    const refreshToken = await new SignJWT({ type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime(process.env.JWT_REFRESH_TTL ?? "30d")
      .sign(jwtSecret);
    const { payload } = await jwtVerify(refreshToken, jwtSecret);
    await repository.setRefreshToken(
      user.id,
      await bcrypt.hash(refreshDigest(refreshToken), 10),
      new Date((payload.exp ?? 0) * 1000),
    );
    return { accessToken, refreshToken, tokenType: "Bearer" };
  }

  async function authenticate(request: FastifyRequest): Promise<UserRecord> {
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, "AUTH_REQUIRED");
    try {
      const { payload } = await jwtVerify(token, jwtSecret);
      if (payload.type !== "access" || !payload.sub) throw new Error("invalid token");
      const user = await repository.findUserById(payload.sub);
      if (!user || user.disabled) throw new Error("user unavailable");
      return user;
    } catch {
      throw new HttpError(401, "INVALID_ACCESS_TOKEN");
    }
  }

  async function requireAdmin(request: FastifyRequest): Promise<UserRecord> {
    const user = await authenticate(request);
    if (!ADMIN_ROLES.has(user.role)) throw new HttpError(403, "ADMIN_REQUIRED");
    return user;
  }

  app.get("/health", { schema: { tags: ["system"] } }, async () => ({
    status: "ok",
    service: "@planet-born/api",
    mode: repository.memoryMode ? "memory" : "postgres",
  }));

  app.post("/auth/register", { schema: { tags: ["auth"] } }, async (request, reply) => {
    const input = AuthRegisterSchema.parse(request.body);
    const user = await repository.createUser({
      ...input,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
    return reply.code(201).send({ user: publicUser(user), ...(await issueTokens(user)) });
  });

  app.post("/auth/login", { schema: { tags: ["auth"] } }, async (request) => {
    const input = AuthLoginSchema.parse(request.body);
    const user = await repository.findUserByEmail(input.email);
    if (!user || user.disabled || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }
    return { user: publicUser(user), ...(await issueTokens(user)) };
  });

  app.post("/auth/refresh", { schema: { tags: ["auth"] } }, async (request) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string().min(1) })
      .parse(request.body);
    let subject: string;
    try {
      const { payload } = await jwtVerify(refreshToken, jwtSecret);
      if (payload.type !== "refresh" || !payload.sub) throw new Error("wrong token type");
      subject = payload.sub;
    } catch {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN");
    }
    const user = await repository.findUserById(subject);
    if (
      !user?.refreshTokenHash ||
      !user.refreshExpiresAt ||
      user.refreshExpiresAt <= new Date() ||
      !(await bcrypt.compare(refreshDigest(refreshToken), user.refreshTokenHash))
    ) {
      throw new HttpError(401, "REFRESH_TOKEN_REUSED_OR_EXPIRED");
    }
    await repository.setRefreshToken(user.id, null, null);
    return { user: publicUser(user), ...(await issueTokens(user)) };
  });

  app.get("/auth/me", { schema: { tags: ["auth"], security: [{ bearerAuth: [] }] } }, async (request) => ({
    user: publicUser(await authenticate(request)),
  }));

  app.get("/planets", { schema: { tags: ["planets"] } }, async () => {
    const rows = await repository.listPlanets();
    return Promise.all(
      rows.map(async (planet) => {
        const state = await repository.getWorldState(planet.id);
        return {
          ...planet,
          civilizationCount: state?.civilizations.length ?? 0,
          speciesCount: state?.species.length ?? 0,
          plantCount: state?.plants.length ?? 0,
          resourceCount: state?.resources.length ?? 0,
          cityCount: state?.civilizations.reduce((sum, civ) => sum + civ.cities, 0) ?? 0,
          technologyCount: state?.civilizations.reduce(
            (sum, civ) => sum + Math.floor(civ.techLevel * 10),
            0,
          ) ?? 0,
        };
      }),
    );
  });

  app.get<{ Params: { id: string } }>(
    "/planets/:id",
    { schema: { tags: ["planets"] } },
    async (request) => {
      const planet = await repository.getPlanet(request.params.id);
      if (!planet) throw new HttpError(404, "PLANET_NOT_FOUND");
      return planet;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/planets/:id/regions",
    { schema: { tags: ["planets"] } },
    async (request) => {
      if (!(await repository.getPlanet(request.params.id))) {
        throw new HttpError(404, "PLANET_NOT_FOUND");
      }
      return repository.getRegions(request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/planets/:id/events",
    { schema: { tags: ["planets"] } },
    async (request) => {
      if (!(await repository.getPlanet(request.params.id))) {
        throw new HttpError(404, "PLANET_NOT_FOUND");
      }
      return repository.getEvents(request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/planets/:id/state",
    { schema: { tags: ["planets"] } },
    async (request) => {
      const [planet, state] = await Promise.all([
        repository.getPlanet(request.params.id),
        repository.getWorldState(request.params.id),
      ]);
      if (!planet || !state) throw new HttpError(404, "PLANET_NOT_FOUND");
      const population = state.civilizations.reduce((sum, civ) => sum + civ.population, 0);
      const pollution =
        state.climate.reduce((sum, cell) => sum + cell.pollution, 0) /
        Math.max(1, state.climate.length);
      return {
        planet,
        summary: {
          tick: state.tick,
          year: state.year,
          population,
          averagePollution: pollution,
          civilizations: state.civilizations.length,
          species: state.species.length,
          plants: state.plants.length,
          resources: state.resources.length,
          events: state.events.length,
        },
      };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/planets/:id/tick",
    { schema: { tags: ["simulation"], security: [{ bearerAuth: [] }] } },
    async (request) => {
      await authenticate(request);
      const input = SimulationTickRequestSchema.parse({
        ...(request.body as object),
        planetId: request.params.id,
      });
      const planet = await repository.getPlanet(input.planetId);
      const current = await repository.getWorldState(input.planetId);
      if (!planet || !current) throw new HttpError(404, "PLANET_NOT_FOUND");
      if (planet.status === "paused") throw new HttpError(409, "PLANET_PAUSED");
      current.tickUnit = input.unit;
      const previousEventCount = current.events.length;
      const next = stepSimulation(current, input.ticks);
      await repository.saveWorldState(input.planetId, next, {
        snapshot: true,
        reason: "manual_tick",
      });
      const events = next.events.slice(previousEventCount);
      void publishRealtime("simulation.tick", input.planetId, {
        tick: next.tick,
        year: next.year,
        events,
      });
      return { tick: next.tick, year: next.year, events };
    },
  );

  app.post(
    "/contributions/analyze",
    { schema: { tags: ["contributions"], security: [{ bearerAuth: [] }] } },
    async (request) => {
      await authenticate(request);
      const input = AnalyzeContributionRequestSchema.parse(request.body);
      const moderation = moderateContributionIdea(input.idea);
      if (!moderation.allowed) {
        throw new HttpError(422, "CONTRIBUTION_REJECTED");
      }
      try {
        const response = await fetch(
          `${process.env.AI_ORCHESTRATOR_URL ?? "http://localhost:4100"}/analyze`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(2_500),
          },
        );
        if (!response.ok) throw new Error(`orchestrator returned ${response.status}`);
        const result = StructuredContributionSchema.parse(await response.json());
        return { structured: result, moderation, source: "ai-orchestrator" };
      } catch {
        return { structured: localAnalyze(input), moderation, source: "local-fallback" };
      }
    },
  );

  app.post(
    "/contributions/confirm",
    { schema: { tags: ["contributions"], security: [{ bearerAuth: [] }] } },
    async (request, reply) => {
      const user = await authenticate(request);
      const input = ConfirmContributionRequestSchema.parse(request.body);
      const current = await repository.getWorldState(input.planetId);
      if (!current) throw new HttpError(404, "PLANET_NOT_FOUND");
      const oldEvents = current.events.length;
      const applied = applyContribution(current, input.structured, input.location, user.id);
      const extraTicks = Math.max(0, input.runPreviewYears - 1);
      const next = extraTicks ? stepSimulation(applied.state, extraTicks) : applied.state;
      const previewEvents = next.events.slice(oldEvents);
      const contribution = await repository.createContribution({
        id: applied.contributionId,
        userId: user.id,
        planetId: input.planetId,
        category: input.structured.category,
        structured: input.structured,
        location: input.location,
        effects: {
          rootEventId: applied.rootEventId,
          previewEventIds: previewEvents.map((event) => event.id),
        },
      });
      await repository.saveWorldState(input.planetId, next, {
        snapshot: true,
        reason: `contribution:${contribution.id}`,
      });
      void publishRealtime("contribution.applied", input.planetId, {
        contributionId: contribution.id,
        events: previewEvents,
      });
      return reply.code(201).send({
        contribution,
        rootEventId: applied.rootEventId,
        previewEvents,
        state: { tick: next.tick, year: next.year },
      });
    },
  );

  app.get(
    "/contributions/mine",
    { schema: { tags: ["contributions"], security: [{ bearerAuth: [] }] } },
    async (request) => repository.listContributions((await authenticate(request)).id),
  );

  app.get(
    "/users/me/impact",
    { schema: { tags: ["users"], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const user = await authenticate(request);
      const contributions = await repository.listContributions(user.id);
      const allEvents = (
        await Promise.all(
          [...new Set(contributions.map((item) => item.planetId))].map((planetId) =>
            repository.getEvents(planetId),
          ),
        )
      ).flat();
      const ownEvents = allEvents.filter((event) => event.userId === user.id);
      return {
        elementsAdded: contributions.length,
        totalChanges: ownEvents.length,
        evolutionDays: contributions.length
          ? Math.floor(
              (Date.now() - Math.min(...contributions.map((item) => item.createdAt.getTime()))) /
                86_400_000,
            )
          : 0,
        civilizationsAffected: new Set(
          ownEvents.flatMap((event) =>
            typeof event.directEffects.civilizationId === "string"
              ? [event.directEffects.civilizationId]
              : [],
          ),
        ).size,
        lastEventTitle: ownEvents.at(-1)?.title ?? null,
      };
    },
  );

  app.get<{ Params: { id: string; eventId: string } }>(
    "/planets/:id/causal/:eventId",
    { schema: { tags: ["simulation"] } },
    async (request) => {
      const state = await repository.getWorldState(request.params.id);
      if (!state) throw new HttpError(404, "PLANET_NOT_FOUND");
      const root = state.causal.nodes.get(request.params.eventId);
      if (!root) throw new HttpError(404, "EVENT_NOT_FOUND");
      return {
        root,
        causes: state.causal.causesOf(root.id),
        effects: state.causal.effectsFrom(root.id),
        links: state.causal.edges.filter(
          (edge) => edge.from === root.id || edge.to === root.id,
        ),
      };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/planets/:id/scenarios",
    { schema: { tags: ["simulation"], security: [{ bearerAuth: [] }] } },
    async (request) => {
      await authenticate(request);
      const input = FutureScenarioRequestSchema.parse({
        ...(request.body as object),
        planetId: request.params.id,
      });
      const state = await repository.getWorldState(input.planetId);
      if (!state) throw new HttpError(404, "PLANET_NOT_FOUND");
      return {
        contributionId: input.contributionId,
        scenarios: runFutureScenarios(state, input.horizons, input.samples),
      };
    },
  );

  app.get(
    "/notifications",
    { schema: { tags: ["notifications"], security: [{ bearerAuth: [] }] } },
    async (request) => repository.listNotifications((await authenticate(request)).id),
  );

  app.get(
    "/admin/users",
    { schema: { tags: ["admin"], security: [{ bearerAuth: [] }] } },
    async (request) => {
      await requireAdmin(request);
      return repository.listUsers();
    },
  );

  for (const action of ["pause", "resume"] as const) {
    app.post<{ Params: { id: string } }>(
      `/admin/planets/:id/${action}`,
      { schema: { tags: ["admin"], security: [{ bearerAuth: [] }] } },
      async (request) => {
        await requireAdmin(request);
        const planet = await repository.setPlanetStatus(
          request.params.id,
          action === "pause" ? "paused" : "running",
        );
        if (!planet) throw new HttpError(404, "PLANET_NOT_FOUND");
        void publishRealtime(`planet.${action}d`, planet.id, { status: planet.status });
        return planet;
      },
    );
  }

  app.post<{ Params: { id: string } }>(
    "/admin/planets/:id/tick",
    { schema: { tags: ["admin"], security: [{ bearerAuth: [] }] } },
    async (request) => {
      await requireAdmin(request);
      const input = z
        .object({ ticks: z.number().int().min(1).max(10_000).default(1) })
        .parse(request.body);
      const state = await repository.getWorldState(request.params.id);
      if (!state) throw new HttpError(404, "PLANET_NOT_FOUND");
      const next = stepSimulation(state, input.ticks);
      await repository.saveWorldState(request.params.id, next, {
        snapshot: true,
        reason: "admin_tick",
      });
      return { tick: next.tick, year: next.year };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/admin/planets/:id/snapshots",
    { schema: { tags: ["admin"], security: [{ bearerAuth: [] }] } },
    async (request) => {
      await requireAdmin(request);
      return repository.listSnapshots(request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/admin/planets/:id/snapshots",
    { schema: { tags: ["admin"], security: [{ bearerAuth: [] }] } },
    async (request, reply) => {
      await requireAdmin(request);
      const state = await repository.getWorldState(request.params.id);
      if (!state) throw new HttpError(404, "PLANET_NOT_FOUND");
      await repository.saveWorldState(request.params.id, state, {
        snapshot: true,
        reason: "admin_snapshot",
      });
      return reply.code(201).send({ tick: state.tick, created: true });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/admin/planets/:id/rollback",
    { schema: { tags: ["admin"], security: [{ bearerAuth: [] }] } },
    async (request, reply) => {
      await requireAdmin(request);
      return reply.code(501).send({
        error: "ROLLBACK_NOT_IMPLEMENTED",
        message: "Snapshot restoration requires an audited rollback workflow.",
      });
    },
  );

  return app;
}
