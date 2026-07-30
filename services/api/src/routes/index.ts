import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import {
  analyzeContributionHeuristic,
  balanceElement,
} from "@planet/simulation-core";
import type { StructuredElement } from "@planet/shared-types";
import {
  RegisterSchema,
  LoginSchema,
  AnalyzeContributionSchema,
  ConfirmContributionSchema,
  TickControlSchema,
  FutureProjectionSchema,
  detectPromptInjection,
} from "@planet/validation";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  createSession,
  rotateRefreshToken,
  revokeSession,
  ADMIN_ROLES,
} from "../auth/auth.js";
import { worldRuntime } from "../services/world-runtime.js";
import { narrateFromFacts, callAiOrchestrator } from "../services/ai-client.js";

async function getUser(req: FastifyRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyAccessToken(header.slice(7));
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.sub))
      .limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

async function requireUser(req: FastifyRequest) {
  const user = await getUser(req);
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }
  return user;
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "planet-api",
    tick: worldRuntime.engine?.state.tick ?? null,
    year: worldRuntime.engine?.state.year ?? null,
  }));

  // ── Auth ──────────────────────────────────────────────
  app.post("/auth/register", async (req, reply) => {
    const body = RegisterSchema.parse(req.body);
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, body.email.toLowerCase()))
      .limit(1);
    if (existing[0]) {
      return reply.code(409).send({ error: "email_taken" });
    }
    const passwordHash = await hashPassword(body.password);
    const [user] = await db
      .insert(schema.users)
      .values({
        email: body.email.toLowerCase(),
        passwordHash,
        displayName: body.displayName,
        locale: body.locale,
        role: "explorer",
      })
      .returning();
    const accessToken = await signAccessToken(user!);
    const { refreshToken } = await createSession(
      user!.id,
      req.headers["user-agent"],
    );
    await db.insert(schema.auditLogs).values({
      actorId: user!.id,
      action: "auth.register",
      targetType: "user",
      targetId: user!.id,
    });
    return {
      user: publicUser(user!),
      accessToken,
      refreshToken,
    };
  });

  app.post("/auth/login", async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, body.email.toLowerCase()))
      .limit(1);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const accessToken = await signAccessToken(user);
    const { refreshToken } = await createSession(
      user.id,
      req.headers["user-agent"],
    );
    return { user: publicUser(user), accessToken, refreshToken };
  });

  app.post("/auth/refresh", async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) return reply.code(400).send({ error: "missing_token" });
    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) return reply.code(401).send({ error: "invalid_refresh" });
    return {
      user: publicUser(rotated.user),
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    };
  });

  app.post("/auth/logout", async (req) => {
    const { refreshToken } = (req.body ?? {}) as { refreshToken?: string };
    if (refreshToken) await revokeSession(refreshToken);
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    const user = await getUser(req);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    return { user: publicUser(user) };
  });

  // ── Planet ────────────────────────────────────────────
  app.get("/planet", async () => {
    const state = worldRuntime.engine.getPublicState();
    const [planet] = await db
      .select()
      .from(schema.planets)
      .where(eq(schema.planets.id, worldRuntime.planetId))
      .limit(1);
    return {
      planet: planet
        ? {
            id: planet.id,
            name: planet.name,
            nameAr: planet.nameAr,
            seed: planet.seed,
            tick: state.tick,
            year: state.year,
            status: planet.status,
            stats: state.stats,
          }
        : null,
      regions: state.regions,
      civilizations: state.civilizations,
      wars: state.wars,
      tradeRoutes: state.tradeRoutes,
      heightPreview: worldRuntime.heightPreview,
      resolution: worldRuntime.resolution,
    };
  });

  app.get("/planet/regions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const region = worldRuntime.engine.state.regions.get(id);
    if (!region) return reply.code(404).send({ error: "not_found" });
    const [dbRegion] = await db
      .select()
      .from(schema.planetRegions)
      .where(eq(schema.planetRegions.id, id))
      .limit(1);
    const civ = region.civilizationId
      ? worldRuntime.engine.state.civilizations.get(region.civilizationId)
      : null;
    const localResources = [...worldRuntime.engine.state.resources.values()].filter(
      (r) => r.regionId === id,
    );
    const localPlants = [...worldRuntime.engine.state.plants.values()].filter((p) =>
      p.regionIds.includes(id),
    );
    const localSpecies = [...worldRuntime.engine.state.species.values()].filter((s) =>
      s.regionIds.includes(id),
    );
    return {
      region: { ...region, name: dbRegion?.name, nameAr: dbRegion?.nameAr },
      civilization: civ
        ? {
            id: civ.id,
            name: civ.name,
            nameAr: civ.nameAr,
            population: civ.population,
            techLevel: civ.techLevel,
          }
        : null,
      resources: localResources.slice(0, 20),
      plants: localPlants.slice(0, 20),
      species: localSpecies.slice(0, 20),
    };
  });

  app.get("/planet/civilizations", async () => {
    return {
      civilizations: [...worldRuntime.engine.state.civilizations.values()].map(
        (c) => ({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr,
          population: c.population,
          techLevel: c.techLevel,
          military: c.military,
          economy: c.economy,
          food: c.food,
          stability: c.stability,
          allies: c.allies,
          enemies: c.enemies,
          regionIds: c.regionIds,
          cityIds: c.cityIds,
        }),
      ),
    };
  });

  app.get("/events", async (req) => {
    const q = req.query as { limit?: string; sinceTick?: string };
    const limit = Math.min(100, Number(q.limit ?? 40));
    const sinceTick = q.sinceTick ? Number(q.sinceTick) : undefined;
    const rows = await db
      .select()
      .from(schema.worldEvents)
      .where(
        sinceTick !== undefined
          ? and(
              eq(schema.worldEvents.planetId, worldRuntime.planetId),
              gte(schema.worldEvents.tick, sinceTick),
            )
          : eq(schema.worldEvents.planetId, worldRuntime.planetId),
      )
      .orderBy(desc(schema.worldEvents.tick), desc(schema.worldEvents.createdAt))
      .limit(limit);
    return { events: rows };
  });

  app.get("/events/:id/causal", async (req, reply) => {
    const { id } = req.params as { id: string };
    const links = await db
      .select()
      .from(schema.causalLinks)
      .where(
        sql`${schema.causalLinks.causeEventId} = ${id} OR ${schema.causalLinks.effectEventId} = ${id}`,
      );
    const relatedIds = new Set<string>([id]);
    for (const l of links) {
      relatedIds.add(l.causeEventId);
      relatedIds.add(l.effectEventId);
    }
    const events = await db
      .select()
      .from(schema.worldEvents)
      .where(
        sql`${schema.worldEvents.id} IN (${sql.join(
          [...relatedIds].map((i) => sql`${i}`),
          sql`, `,
        )})`,
      );
    return { eventId: id, links, events };
  });

  app.get("/timeline", async () => {
    const snaps = await db
      .select()
      .from(schema.timelineSnapshots)
      .where(eq(schema.timelineSnapshots.planetId, worldRuntime.planetId))
      .orderBy(schema.timelineSnapshots.year);
    return { snapshots: snaps };
  });

  // ── Contributions ─────────────────────────────────────
  app.post("/contributions/analyze", async (req, reply) => {
    const user = await requireUser(req);
    const body = AnalyzeContributionSchema.parse(req.body);
    const mod = detectPromptInjection(body.text);
    await db.insert(schema.moderationResults).values({
      userId: user.id,
      textHash: Buffer.from(body.text).toString("base64").slice(0, 64),
      blocked: mod.blocked,
      reasons: mod.reasons,
    });
    if (mod.blocked) {
      return reply.code(400).send({
        error: "content_blocked",
        reasons: mod.reasons,
        message: "Input failed moderation / injection checks.",
      });
    }

    worldRuntime.broadcast({
      type: "contribution.status",
      payload: { contributionId: "pending", status: "analyzing" },
    });

    const provider = process.env.AI_PROVIDER ?? "sandbox";
    const sandbox = (process.env.AI_SANDBOX_MODE ?? "true") === "true" || !process.env.OPENAI_API_KEY;

    let structured: StructuredElement;
    let narrative: string;
    let narrativeAr: string;
    let usedProvider = provider;

    if (sandbox || provider === "sandbox") {
      usedProvider = "sandbox";
      structured = analyzeContributionHeuristic(body.text, body.category);
      structured = balanceElement(structured);
      const narr = narrateFromFacts(structured, []);
      narrative = narr.en;
      narrativeAr = narr.ar;
    } else {
      try {
        const ai = await callAiOrchestrator({
          text: body.text,
          category: body.category,
          locale: body.locale,
        });
        structured = balanceElement(ai.structured);
        narrative = ai.narrative;
        narrativeAr = ai.narrativeAr;
        usedProvider = ai.provider;
      } catch {
        usedProvider = "sandbox_fallback";
        structured = balanceElement(
          analyzeContributionHeuristic(body.text, body.category),
        );
        const narr = narrateFromFacts(structured, []);
        narrative = narr.en;
        narrativeAr = narr.ar;
      }
    }

    const [aiReq] = await db
      .insert(schema.aiRequests)
      .values({
        userId: user.id,
        provider: usedProvider,
        purpose: "analyze_contribution",
        sandbox: usedProvider.includes("sandbox"),
        input: { text: body.text, category: body.category },
        output: { structured, narrative, narrativeAr },
        status: "done",
        costUsd: usedProvider.includes("sandbox") ? 0 : 0.002,
      })
      .returning();

    const [cache] = await db
      .insert(schema.analysisCache)
      .values({
        userId: user.id,
        text: body.text,
        structured,
        provider: usedProvider,
        narrative,
        narrativeAr,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning();

    worldRuntime.broadcast({
      type: "ai.status",
      payload: {
        requestId: aiReq!.id,
        status: usedProvider.includes("sandbox") ? "sandbox" : "done",
        provider: usedProvider,
      },
    });

    return {
      analysisId: cache!.id,
      provider: usedProvider,
      sandbox: usedProvider.includes("sandbox"),
      structured,
      narrative,
      narrativeAr,
      suitableRegions: [...worldRuntime.engine.state.regions.values()]
        .filter(
          (r) =>
            structured.possibleBiomes.includes(r.biome as never) ||
            r.biome === "coast",
        )
        .slice(0, 12)
        .map((r) => ({
          id: r.id,
          biome: r.biome,
          lat: r.lat,
          lon: r.lon,
          fertility: r.fertility,
        })),
    };
  });

  app.post("/contributions/confirm", async (req, reply) => {
    const user = await requireUser(req);
    const body = ConfirmContributionSchema.parse(req.body);
    const [analysis] = await db
      .select()
      .from(schema.analysisCache)
      .where(eq(schema.analysisCache.id, body.analysisId))
      .limit(1);
    if (!analysis) return reply.code(404).send({ error: "analysis_not_found" });

    const structured = analysis.structured as StructuredElement;
    if (!structured.balanced && !body.acceptBalance) {
      return reply.code(400).send({
        error: "balance_required",
        balanceNotes: structured.balanceNotes,
      });
    }

    const region = worldRuntime.engine.state.regions.get(body.regionId);
    if (!region) return reply.code(400).send({ error: "invalid_region" });

    const [contrib] = await db
      .insert(schema.userContributions)
      .values({
        userId: user.id,
        planetId: worldRuntime.planetId,
        category: structured.category,
        rawText: analysis.text,
        structured,
        regionId: body.regionId,
        status: "simulating",
      })
      .returning();

    const result = await worldRuntime.applyUserElement(
      structured,
      body.regionId,
      contrib!.id,
      user.id,
    );

    // XP
    await db
      .update(schema.users)
      .set({
        xp: user.xp + 50,
        level: Math.floor((user.xp + 50) / 200) + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    const projection = worldRuntime.engine.projectFuture([1, 10, 100, 1000], 6);

    return {
      contribution: contrib,
      entityId: result.entityId,
      events: result.events,
      beforeTick: result.beforeTick,
      afterTick: worldRuntime.engine.state.tick,
      projection,
      causalLinks: worldRuntime.engine.events
        .edgesAll()
        .filter((e) =>
          result.events.some(
            (ev) => ev.id === e.causeEventId || ev.id === e.effectEventId,
          ),
        ),
    };
  });

  app.get("/contributions/mine", async (req, reply) => {
    const user = await requireUser(req);
    const rows = await db
      .select()
      .from(schema.userContributions)
      .where(eq(schema.userContributions.userId, user.id))
      .orderBy(desc(schema.userContributions.createdAt));
    return { contributions: rows };
  });

  app.post("/simulation/project", async (req) => {
    await requireUser(req);
    const body = FutureProjectionSchema.parse(req.body ?? {});
    const projection = worldRuntime.engine.projectFuture(body.years, body.samples);
    return {
      probabilistic: true,
      disclaimer:
        "Results are Monte Carlo projections, not certainties. Uncertainty is reported per horizon.",
      disclaimerAr:
        "النتائج إسقاطات مونت كارلو وليست يقينًا. تُعرض درجة عدم اليقين لكل أفق زمني.",
      ...projection,
    };
  });

  app.post("/simulation/tick", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role) && user.role !== "simulation_manager") {
      // Allow explorers to advance a few ticks for demo
      const body = TickControlSchema.parse(req.body ?? {});
      if (body.count > 10) {
        return reply.code(403).send({ error: "tick_limit" });
      }
      const events = await worldRuntime.runTicks(body.count);
      return { tick: worldRuntime.engine.state.tick, year: worldRuntime.engine.state.year, events };
    }
    const body = TickControlSchema.parse(req.body ?? {});
    const events = await worldRuntime.runTicks(body.count);
    return { tick: worldRuntime.engine.state.tick, year: worldRuntime.engine.state.year, events };
  });

  app.post("/simulation/pause", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role)) return reply.code(403).send({ error: "forbidden" });
    worldRuntime.stopAutotick();
    await db
      .update(schema.planets)
      .set({ status: "paused" })
      .where(eq(schema.planets.id, worldRuntime.planetId));
    return { status: "paused" };
  });

  app.post("/simulation/resume", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role)) return reply.code(403).send({ error: "forbidden" });
    worldRuntime.startAutotick();
    await db
      .update(schema.planets)
      .set({ status: "running" })
      .where(eq(schema.planets.id, worldRuntime.planetId));
    return { status: "running" };
  });

  app.post("/simulation/rollback", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role)) return reply.code(403).send({ error: "forbidden" });
    const { tick } = req.body as { tick: number };
    const ok = worldRuntime.engine.rollbackTo(tick);
    if (!ok) return reply.code(404).send({ error: "snapshot_not_found" });
    await db
      .update(schema.planets)
      .set({
        currentTick: worldRuntime.engine.state.tick,
        currentYear: worldRuntime.engine.state.year,
      })
      .where(eq(schema.planets.id, worldRuntime.planetId));
    await db.insert(schema.auditLogs).values({
      actorId: user.id,
      action: "simulation.rollback",
      targetType: "planet",
      targetId: worldRuntime.planetId,
      detail: { tick },
    });
    return {
      tick: worldRuntime.engine.state.tick,
      year: worldRuntime.engine.state.year,
    };
  });

  app.get("/notifications", async (req) => {
    const user = await requireUser(req);
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, user.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);
    return { notifications: rows };
  });

  app.post("/notifications/:id/read", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    await db
      .update(schema.notifications)
      .set({ read: true })
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, user.id),
        ),
      );
    return { ok: true };
  });

  // ── Admin ─────────────────────────────────────────────
  app.get("/admin/overview", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role)) return reply.code(403).send({ error: "forbidden" });
    const [usersCount] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.users);
    const [contribCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.userContributions);
    const [eventsCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.worldEvents);
    const [aiCost] = await db
      .select({ c: sql<number>`coalesce(sum(cost_usd),0)` })
      .from(schema.aiRequests);
    return {
      users: usersCount?.c ?? 0,
      contributions: contribCount?.c ?? 0,
      events: eventsCount?.c ?? 0,
      aiCostUsd: aiCost?.c ?? 0,
      planet: worldRuntime.engine.getPublicState().stats,
      tick: worldRuntime.engine.state.tick,
      year: worldRuntime.engine.state.year,
      running: worldRuntime.running,
    };
  });

  app.get("/admin/users", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role)) return reply.code(403).send({ error: "forbidden" });
    const rows = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).limit(200);
    return { users: rows.map(publicUser) };
  });

  app.get("/admin/audit", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role)) return reply.code(403).send({ error: "forbidden" });
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100);
    return { logs: rows };
  });

  app.get("/admin/ai-usage", async (req, reply) => {
    const user = await requireUser(req);
    if (!ADMIN_ROLES.has(user.role)) return reply.code(403).send({ error: "forbidden" });
    const rows = await db
      .select()
      .from(schema.aiRequests)
      .orderBy(desc(schema.aiRequests.createdAt))
      .limit(100);
    return { requests: rows };
  });
}

function publicUser(u: typeof schema.users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    locale: u.locale,
    level: u.level,
    xp: u.xp,
    createdAt: u.createdAt,
  };
}
