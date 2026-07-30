import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  applyContribution,
  computeContributionEffects,
} from "@planet/simulation-models";
import { applyContributionSchema, contributionIdeaSchema } from "@planet/validation";
import { track } from "@planet/analytics";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { parseIdea, narrate } from "../services/ai-client.js";
import { moderateContent } from "../services/moderation.js";
import { loadWorldState, persistWorldState } from "../services/world-persistence.js";
import { broadcast, sendToUser } from "../ws/hub.js";
import { buildCausalGraph } from "@planet/simulation-models";

export async function contributionRoutes(app: FastifyInstance) {
  app.post(
    "/contributions/analyze",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = contributionIdeaSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const moderation = moderateContent(parsed.data.idea);
      await db.insert(schema.moderationResults).values({
        userId: (req.user as { id: string }).id,
        content: parsed.data.idea,
        allowed: moderation.allowed,
        reasons: moderation.reasons,
      });
      if (!moderation.allowed) {
        return reply.code(400).send({ error: "moderation_rejected", reasons: moderation.reasons });
      }

      let ai;
      try {
        ai = await parseIdea(parsed.data);
      } catch {
        return reply.code(503).send({
          error: "ai_unavailable",
          message: "AI orchestrator unreachable. Start @planet/ai-orchestrator or use sandbox.",
        });
      }

      await db.insert(schema.aiRequests).values({
        userId: (req.user as { id: string }).id,
        provider: ai.provider,
        sandbox: ai.sandbox,
        purpose: "parse_idea",
        input: parsed.data,
        output: ai.structured,
      });

      const planets = await db.select().from(schema.planets).limit(1);
      const planet = planets[0];
      const world = planet ? await loadWorldState(planet.id) : null;
      const suitable =
        world?.regions
          .filter(
            (r) =>
              r.biome !== "ocean" &&
              ai.structured.possibleBiomes.includes(r.biome as never),
          )
          .sort((a, b) => b.fertility - a.fertility)
          .slice(0, 12)
          .map((r) => ({
            id: r.id,
            name: r.name,
            nameEn: r.nameEn,
            biome: r.biome,
            lat: r.lat,
            lng: r.lng,
            elevation: r.elevation,
            temperature: r.temperature,
            moisture: r.moisture,
            fertility: r.fertility,
            pollution: r.pollution,
            population: r.population,
            carryingCapacity: r.carryingCapacity,
            resources: r.resourceIds.slice(0, 5),
            civilizationId: r.civilizationId,
          })) ?? [];

      const sampleBiome = suitable[0]?.biome ?? ai.structured.possibleBiomes[0]!;
      const shortTerm = computeContributionEffects(ai.structured, sampleBiome);
      const causalGraph = buildCausalGraph(ai.structured.name, shortTerm);
      const story = await narrate({
        locale: parsed.data.locale,
        contributionName: ai.structured.name,
        effects: shortTerm,
        eventTitles: [],
      });

      track({ name: "contribution_analyze", properties: { category: parsed.data.category } });

      return {
        structured: ai.structured,
        suitableRegions: suitable,
        successProbability: suitable.length ? 0.72 : 0.35,
        shortTermEffects: shortTerm,
        longTermEffects: shortTerm.map((e) => ({ ...e, delta: e.delta * 0.45 })),
        causalGraph,
        scenarios: [
          {
            horizonYears: 1,
            label: "most_likely",
            probability: 0.5,
            uncertainty: 0.2,
            narrative: story.narrative,
            narrativeEn: story.narrativeEn,
            keyFactors: shortTerm.map((e) => e.metric).slice(0, 3),
            effects: shortTerm,
          },
        ],
        narrative: story.narrative,
        narrativeEn: story.narrativeEn,
        provider: ai.provider,
        sandbox: ai.sandbox,
      };
    },
  );

  app.post(
    "/contributions/apply",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = applyContributionSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const user = req.user as { id: string; displayName: string };
      const moderation = moderateContent(parsed.data.idea);
      if (!moderation.allowed) {
        return reply.code(400).send({ error: "moderation_rejected", reasons: moderation.reasons });
      }

      const world = await loadWorldState(parsed.data.planetId);
      if (!world) return reply.code(404).send({ error: "world_missing" });

      // snapshot before apply for comparison/rollback
      await db.insert(schema.timelineSnapshots).values({
        planetId: parsed.data.planetId,
        label: `before_contribution_${Date.now()}`,
        tick: world.tick,
        year: world.year,
        state: world as unknown as Record<string, unknown>,
      });

      const contributionId = randomUUID();
      const result = applyContribution({
        state: world,
        userId: user.id,
        contributionId,
        regionId: parsed.data.regionId,
        structured: parsed.data.structured,
        simulateYears: 1,
      });

      await persistWorldState(parsed.data.planetId, result.state, { replace: true });

      await db.insert(schema.userContributions).values({
        id: contributionId,
        planetId: parsed.data.planetId,
        userId: user.id,
        category: parsed.data.category,
        idea: parsed.data.idea,
        structured: parsed.data.structured,
        regionId: parsed.data.regionId,
        appliedTick: result.event.tick,
        status: "applied",
      });

      await db.insert(schema.causalLinks).values({
        planetId: parsed.data.planetId,
        contributionId,
        graph: result.causalGraph,
      });

      const story = await narrate({
        locale: "ar",
        contributionName: parsed.data.structured.name,
        effects: result.effects.slice(0, 8),
        eventTitles: [result.event.title, ...result.state.eventLog.slice(-3).map((e) => e.title)],
      });

      // attach narratives into scenarios
      const scenarios = result.scenarios.map((s) => ({
        ...s,
        narrative: story.narrative,
        narrativeEn: story.narrativeEn,
      }));

      await db.insert(schema.notifications).values({
        userId: user.id,
        title: "أُضيف عنصرك إلى العالم",
        body: `${parsed.data.structured.name} بدأ يؤثر في المحاكاة.`,
        meta: { contributionId, planetId: parsed.data.planetId },
      });

      // schedule-like follow-up notification for evolution (immediate demo tick)
      await db.insert(schema.notifications).values({
        userId: user.id,
        title: "تطور تأثير مساهمتك",
        body: "ظهرت نتائج أولية مرتبطة بعنصرك في سجل الأحداث.",
        meta: { contributionId, kind: "evolution" },
      });

      await db
        .update(schema.users)
        .set({
          xp: (await db.select().from(schema.users).where(eq(schema.users.id, user.id)))[0]!
            .xp + 50,
        })
        .where(eq(schema.users.id, user.id));

      broadcast(
        {
          type: "delta",
          ts: Date.now(),
          payload: {
            planetId: parsed.data.planetId,
            tick: result.state.tick,
            events: [result.event],
            regionPatches: [
              {
                id: parsed.data.regionId,
                pollution: result.state.regions.find((r) => r.id === parsed.data.regionId)
                  ?.pollution,
              },
            ],
          },
        },
        parsed.data.planetId,
      );

      sendToUser(user.id, {
        type: "notification",
        ts: Date.now(),
        payload: {
          title: "أُضيف عنصرك إلى العالم",
          contributionId,
        },
      });

      track({
        name: "contribution_apply",
        properties: { category: parsed.data.category, contributionId },
      });

      return {
        contributionId,
        event: result.event,
        effects: result.effects,
        causalGraph: result.causalGraph,
        scenarios,
        narrative: story.narrative,
        narrativeEn: story.narrativeEn,
        successProbability: result.successProbability,
        planet: {
          tick: result.state.tick,
          year: result.state.year,
        },
      };
    },
  );

  app.get(
    "/contributions/mine",
    { preHandler: [app.authenticate] },
    async (req) => {
      const user = req.user as { id: string };
      const rows = await db
        .select()
        .from(schema.userContributions)
        .where(eq(schema.userContributions.userId, user.id))
        .orderBy(desc(schema.userContributions.createdAt));
      return { contributions: rows };
    },
  );

  app.get(
    "/me/impact",
    { preHandler: [app.authenticate] },
    async (req) => {
      const user = req.user as { id: string };
      const rows = await db
        .select()
        .from(schema.userContributions)
        .where(eq(schema.userContributions.userId, user.id));
      const events = await db
        .select()
        .from(schema.worldEvents)
        .where(eq(schema.worldEvents.userId, user.id))
        .orderBy(desc(schema.worldEvents.createdAt))
        .limit(20);
      return {
        elementsAdded: rows.length,
        totalChanges: events.length + rows.length * 3,
        civilizationsAffected: new Set(
          events.filter((e) => e.type.includes("CIVILIZATION") || e.type.includes("WAR")).map((e) => e.id),
        ).size,
        evolutionDays: rows.length ? 47 : 0,
        lastEventTitle: events[0]?.title,
      };
    },
  );

  app.get(
    "/me/notifications",
    { preHandler: [app.authenticate] },
    async (req) => {
      const user = req.user as { id: string };
      const rows = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, user.id))
        .orderBy(desc(schema.notifications.createdAt))
        .limit(50);
      return { notifications: rows };
    },
  );

  app.get("/contributions/:id/causal", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .select()
      .from(schema.causalLinks)
      .where(eq(schema.causalLinks.contributionId, id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "not_found" });
    return { graph: row.graph };
  });

  app.post(
    "/contributions/:id/forecast",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const [contrib] = await db
        .select()
        .from(schema.userContributions)
        .where(eq(schema.userContributions.id, id))
        .limit(1);
      if (!contrib) return reply.code(404).send({ error: "not_found" });
      const world = await loadWorldState(contrib.planetId);
      if (!world) return reply.code(404).send({ error: "world_missing" });

      // Re-run local monte carlo via applyContribution forecast fields
      const result = applyContribution({
        state: world,
        userId: contrib.userId,
        contributionId: `${id}_forecast`,
        regionId: contrib.regionId,
        structured: contrib.structured as never,
        simulateYears: 0,
      });

      return {
        note: "احتمالي — ليس تنبؤًا مؤكدًا / Probabilistic, not certain",
        scenarios: result.scenarios,
      };
    },
  );
}
