import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  contributionConfirmSchema,
  contributionIdeaSchema,
  detectInjection,
  sanitizeUserText,
} from "@planet/validation";
import { previewImpact, balanceContribution } from "@planet/simulation-models";
import { requireAuth } from "../lib/auth.js";
import { db } from "../db/client.js";
import {
  userContributions,
  moderationResults,
  aiRequests,
  profiles,
  notifications,
} from "../db/schema.js";
import { analyzeIdea } from "../lib/ai-client.js";
import {
  applyUserContribution,
  asWorldState,
  getPrimaryPlanet,
} from "../services/world-service.js";

export async function contributionRoutes(app: FastifyInstance) {
  app.post("/contributions/analyze", { preHandler: requireAuth() }, async (req, reply) => {
    const body = contributionIdeaSchema.parse(req.body);
    const idea = sanitizeUserText(body.idea);

    if (detectInjection(idea)) {
      await db.insert(moderationResults).values({
        userId: req.dbUser!.id,
        text: idea,
        allowed: false,
        reasons: ["prompt_injection"],
      });
      return reply.code(400).send({
        error: "moderation_blocked",
        message: "Content rejected by safety filters",
        messageAr: "رُفض المحتوى بواسطة فلاتر السلامة",
      });
    }

    const started = Date.now();
    const analysis = await analyzeIdea({
      category: body.category,
      idea,
      locale: body.locale,
    });

    await db.insert(aiRequests).values({
      userId: req.dbUser!.id,
      provider: analysis.provider,
      purpose: "analyze_contribution",
      input: body,
      output: analysis,
      sandbox: analysis.sandbox,
      costUsd: 0,
      latencyMs: Date.now() - started,
    });

    await db.insert(moderationResults).values({
      userId: req.dbUser!.id,
      text: idea,
      allowed: analysis.moderation.allowed,
      reasons: analysis.moderation.reasons,
    });

    if (!analysis.moderation.allowed) {
      return reply.code(400).send({
        error: "moderation_blocked",
        message: "Content rejected",
        messageAr: "رُفض المحتوى",
        reasons: analysis.moderation.reasons,
      });
    }

    const planet = await getPrimaryPlanet();
    if (!planet) return reply.code(503).send({ error: "no_planet" });
    const state = asWorldState(planet);
    const regionSimId =
      body.regionId?.replace(`${planet.id}:`, "") ??
      state.regions.find((r) => analysis.structured.possibleBiomes.includes(r.biome) && r.biome !== "ocean")
        ?.id ??
      state.regions.find((r) => r.biome !== "ocean")!.id;

    const structured = balanceContribution(analysis.structured);
    const preview = previewImpact(state, structured, regionSimId);

    const id = randomUUID();
    await db.insert(userContributions).values({
      id,
      planetId: planet.id,
      userId: req.dbUser!.id,
      category: body.category,
      name: structured.name,
      nameAr: structured.nameAr,
      idea,
      regionId: regionSimId,
      status: "analyzed",
      structured,
      preview,
    });

    app.broadcast?.({
      channel: "ai.status",
      type: "analysis.completed",
      payload: { analysisId: id, sandbox: analysis.sandbox },
      ts: new Date().toISOString(),
      planetId: planet.id,
    });

    return {
      analysisId: id,
      structured,
      preview,
      suggestedRegionId: regionSimId,
      provider: analysis.provider,
      sandbox: analysis.sandbox,
    };
  });

  app.post("/contributions/confirm", { preHandler: requireAuth() }, async (req, reply) => {
    const body = contributionConfirmSchema.parse(req.body);
    const [row] = await db
      .select()
      .from(userContributions)
      .where(eq(userContributions.id, body.analysisId))
      .limit(1);
    if (!row || row.userId !== req.dbUser!.id) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (row.status === "applied") {
      return reply.code(409).send({ error: "already_applied", messageAr: "طُبّقت المساهمة مسبقًا" });
    }
    if (!row.structured) {
      return reply.code(400).send({ error: "missing_analysis" });
    }

    const planet = await getPrimaryPlanet();
    if (!planet) return reply.code(503).send({ error: "no_planet" });

    const regionSimId = body.regionId.replace(`${planet.id}:`, "");
    await db
      .update(userContributions)
      .set({ regionId: regionSimId, status: "applying" })
      .where(eq(userContributions.id, row.id));

    const result = await applyUserContribution({
      planetId: planet.id,
      userId: req.dbUser!.id,
      contributionId: row.id,
      regionSimId,
      structured: row.structured as never,
      runForecast: body.runForecast,
    });

    app.broadcast?.({
      channel: "world.events",
      type: "contribution.applied",
      payload: {
        contributionId: row.id,
        events: result.events,
        narrativeAr: result.narrativeAr,
      },
      ts: new Date().toISOString(),
      planetId: planet.id,
    });

    app.broadcast?.({
      channel: "notification",
      type: "user.notify",
      payload: { userId: req.dbUser!.id, kind: "contribution_applied" },
      ts: new Date().toISOString(),
    });

    return {
      contributionId: row.id,
      ...result,
    };
  });

  app.get("/contributions/mine", { preHandler: requireAuth() }, async (req) => {
    const rows = await db
      .select()
      .from(userContributions)
      .where(eq(userContributions.userId, req.dbUser!.id))
      .orderBy(desc(userContributions.createdAt))
      .limit(50);
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, req.dbUser!.id)).limit(1);
    return { contributions: rows, stats: profile };
  });

  app.get("/notifications", { preHandler: requireAuth() }, async (req) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.dbUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return { notifications: rows };
  });

  app.post<{ Params: { id: string } }>(
    "/notifications/:id/read",
    { preHandler: requireAuth() },
    async (req) => {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, req.params.id));
      return { ok: true };
    },
  );
}
