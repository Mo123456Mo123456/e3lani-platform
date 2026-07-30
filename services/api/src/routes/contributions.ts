/**
 * The contribution flow — the heart of the product:
 *   analyze   text → structured traits (AI orchestrator / sandbox)
 *   preview   dry-run on an isolated branch: viability + predicted events
 *   place     insert into the live world after balance + moderation checks
 *   impact    the full causal downstream of the addition
 *   narrative constrained prose about what actually happened
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Contribution } from "@planet/shared-types";
import { analyzeContributionInput, placeContributionInput } from "@planet/validation";
import {
  contributionDescendants,
  previewContribution,
  validateBalance,
} from "@planet/simulation-models";
import { requireAuth } from "../auth/guards.js";
import { progressionRoles } from "../auth/guards.js";
import { moderateText, toModerationResult } from "../moderation/moderation.js";
import { narrateContribution } from "../ai/narrator.js";
import type { AppContext } from "../context.js";

export function registerContributionRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/planets/:planetId/contributions/analyze", {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: { tags: ["contributions"], summary: "Analyze a free-text idea into structured traits" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const parsed = analyzeContributionInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: "invalid_input", details: parsed.error.flatten() });
    }
    const { text, category, locale } = parsed.data;

    const verdict = moderateText(text);
    const analysisId = randomUUID();
    await ctx.repository.saveModeration(toModerationResult(analysisId, verdict));
    if (verdict.verdict === "block") {
      ctx.tracker.track("contribution_rejected", { userId: request.user.sub, planetId });
      return reply.code(422).send({ error: "content_blocked", reasons: verdict.reasons });
    }

    const { structured, provider } = await ctx.ai.parseContribution(text, category, locale, request.user.sub);
    const balance = validateBalance(structured);

    const contribution: Contribution = {
      id: analysisId,
      userId: request.user.sub,
      planetId,
      rawText: text,
      structured,
      balance,
      originCell: -1,
      status: "analyzed",
      createdAtTick: 0,
      createdAt: new Date().toISOString(),
      impactScore: 0,
    };
    await ctx.repository.saveContribution(contribution);
    ctx.tracker.track("contribution_analyzed", { userId: request.user.sub, planetId, properties: { category: structured.category } });

    return reply.send({
      analysisId,
      structured,
      balance,
      provider,
      sandbox: ctx.ai.isSandbox,
      flaggedForReview: verdict.verdict === "review",
    });
  });

  app.post("/planets/:planetId/contributions/preview", {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: { tags: ["contributions"], summary: "Dry-run a contribution on an isolated branch" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const body = z.object({ analysisId: z.string(), cell: z.number().int().min(0) }).safeParse(request.body);
    if (!body.success) return reply.code(422).send({ error: "invalid_input" });
    const contribution = await ctx.repository.findContribution(body.data.analysisId);
    if (!contribution || contribution.userId !== request.user.sub) {
      return reply.code(404).send({ error: "not_found" });
    }
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const cell = engine.state.grid.cells[body.data.cell];
    if (!cell) return reply.code(422).send({ error: "invalid_cell" });

    const acceptSuggestion = (request.body as { acceptBalanceSuggestion?: boolean }).acceptBalanceSuggestion === true;
    const trial: Contribution = {
      ...contribution,
      structured:
        acceptSuggestion && contribution.balance.suggested
          ? contribution.balance.suggested
          : contribution.structured,
      originCell: body.data.cell,
    };
    const preview = previewContribution(engine, trial, 40);
    return {
      viability: preview.survivalScore,
      predictedEvents: preview.events.slice(0, 20),
      environment: {
        biome: cell.biome,
        temperature: cell.temperature,
        moisture: cell.moisture,
        fertility: cell.fertility,
      },
    };
  });

  app.post("/planets/:planetId/contributions/place", {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: { tags: ["contributions"], summary: "Insert the contribution into the live world" },
  }, async (request, reply) => {
    const { planetId } = request.params as { planetId: string };
    const parsed = placeContributionInput.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send({ error: "invalid_input", details: parsed.error.flatten() });

    const contribution = await ctx.repository.findContribution(parsed.data.analysisId);
    if (!contribution || contribution.userId !== request.user.sub) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (contribution.status === "placed") {
      return reply.code(409).send({ error: "already_placed" });
    }
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const cell = engine.state.grid.cells[parsed.data.cell];
    if (!cell) return reply.code(422).send({ error: "invalid_cell" });
    if (cell.height < engine.state.grid.seaLevel && contribution.structured.category !== "resource" && !contribution.structured.possibleBiomes.includes("ocean")) {
      return reply.code(422).send({ error: "cell_unsuitable", detail: "cannot place a terrestrial element in the ocean" });
    }

    const final: Contribution = {
      ...contribution,
      structured:
        parsed.data.acceptBalanceSuggestion && contribution.balance.suggested
          ? contribution.balance.suggested
          : contribution.structured,
      originCell: parsed.data.cell,
    };
    // re-validate balance at the gate — an unbalanced idea is only placed
    // when the user explicitly accepted the balanced suggestion
    const finalBalance = validateBalance(final.structured);
    if (!finalBalance.balanced && !parsed.data.acceptBalanceSuggestion) {
      return reply.code(422).send({
        error: "unbalanced_contribution",
        balance: finalBalance,
        detail: "accept the balanced suggestion to place this element",
      });
    }
    final.balance = finalBalance;

    const events = await ctx.worlds.placeContribution(planetId, final);

    // progression: achievements unlock roles
    const userContributions = await ctx.repository.contributionsByUser(request.user.sub);
    const placed = userContributions.filter((c) => c.status === "placed");
    const byCategory: Record<string, number> = {};
    for (const c of placed) byCategory[c.structured.category] = (byCategory[c.structured.category] ?? 0) + 1;
    const user = await ctx.repository.findUserById(request.user.sub);
    if (user) {
      const roles = progressionRoles(user.roles, placed.length, byCategory);
      if (roles.length !== user.roles.length) {
        await ctx.repository.updateUserRoles(user.id, roles);
      }
    }

    ctx.tracker.track("contribution_placed", { userId: request.user.sub, planetId, properties: { category: final.structured.category } });
    return reply.code(201).send({ contribution: final, events });
  });

  app.get("/planets/:planetId/contributions/:contributionId/impact", {
    preHandler: requireAuth,
    schema: { tags: ["contributions"], summary: "Causal downstream of a contribution" },
  }, async (request, reply) => {
    const { planetId, contributionId } = request.params as { planetId: string; contributionId: string };
    const contribution = await ctx.repository.findContribution(contributionId);
    if (!contribution) return reply.code(404).send({ error: "not_found" });
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const chain = contributionDescendants(engine.journal, contributionId);
    return {
      contribution,
      impact: {
        depth: chain.depth,
        eventCount: chain.events.length,
        events: chain.events.slice(0, 100),
        links: chain.links.slice(0, 200),
      },
    };
  });

  app.get("/planets/:planetId/contributions/:contributionId/narrative", {
    preHandler: requireAuth,
    schema: { tags: ["contributions"], summary: "Constrained narrative of what really happened" },
  }, async (request, reply) => {
    const { planetId, contributionId } = request.params as { planetId: string; contributionId: string };
    const locale = (request.query as { locale?: string }).locale === "en" ? "en" : "ar";
    const contribution = await ctx.repository.findContribution(contributionId);
    if (!contribution) return reply.code(404).send({ error: "not_found" });
    const engine = await ctx.worlds.ensureLoaded(planetId);
    const narration = narrateContribution(engine.journal, contributionId, contribution.structured.name, locale);
    return { narrative: narration.text, eventIds: narration.eventIds, provider: narration.provider };
  });

  app.get("/planets/:planetId/contributions", {
    preHandler: requireAuth,
    schema: { tags: ["contributions"], summary: "My contributions on this planet" },
  }, async (request) => {
    const { planetId } = request.params as { planetId: string };
    const mine = (await ctx.repository.contributionsByUser(request.user.sub)).filter(
      (c) => c.planetId === planetId,
    );
    return { contributions: mine };
  });
}
