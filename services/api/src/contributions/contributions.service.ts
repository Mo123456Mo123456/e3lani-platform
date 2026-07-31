import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { runScenarioSet, suggestOrigins } from "@kawkab/simulation";
import type { ContributionCreateRequest, ContributionPreview, Locale, NarrationFact, ScenarioReport } from "@kawkab/shared-types";
import { contributionCreateSchema } from "@kawkab/validation";
import { AiClientService } from "../ai/ai.service.js";
import { EventBus } from "../common/event-bus.js";
import { PrismaService } from "../common/prisma.service.js";
import { WorldManager } from "../worlds/world-manager.js";

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly manager: WorldManager,
    private readonly bus: EventBus,
  ) {}

  /**
   * Stage 1 of the contribution flow: moderate → parse → balance → preview.
   * Nothing enters the world yet.
   */
  async createPreview(userId: string, input: ContributionCreateRequest, locale: Locale): Promise<ContributionPreview & { contributionId: string; sandbox: boolean }> {
    const parsed = contributionCreateSchema.parse(input);
    const planet = await this.prisma.planet.findUnique({ where: { id: parsed.planetId } });
    if (!planet) throw new NotFoundException("planet not found");
    const engine = this.manager.get(planet.id);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");

    // moderation gate: rules first, result persisted for the review queue
    const moderation = await this.ai.moderate(parsed.text);
    const contribution = await this.prisma.userContribution.create({
      data: {
        userId,
        planetId: planet.id,
        category: parsed.category,
        rawText: parsed.text.slice(0, 4000),
        status: "analyzing",
        moderationStatus: moderation.status,
      },
    });
    await this.prisma.moderationResult.create({
      data: {
        contributionId: contribution.id,
        text: parsed.text.slice(0, 4000),
        status: moderation.status,
        score: moderation.score,
        reasons: moderation.reasons,
      },
    });
    if (moderation.status === "rejected") {
      await this.prisma.userContribution.update({ where: { id: contribution.id }, data: { status: "rejected" } });
      throw new ForbiddenException({ code: "CONTENT_REJECTED", message: "This idea cannot enter the world.", reasons: moderation.reasons });
    }

    const preview = await this.ai.previewContribution({ text: parsed.text, category: parsed.category, locale, userId });
    const effective = preview.balance.acceptable ? preview.balance.adjusted : preview.parsed;
    const origins = suggestOrigins({ state: engine.state, grid: engine.grid }, effective, 8);
    const successProbability = computeSuccessProbability(preview.balance.acceptable, origins, effective.risks.length);

    await this.prisma.userContribution.update({
      where: { id: contribution.id },
      data: { parsed: effective as unknown as object, status: "preview", sandbox: preview.sandbox },
    });

    return {
      contributionId: contribution.id,
      parsed: effective,
      balance: preview.balance,
      suggestedOrigin: origins,
      successProbability,
      expectedShortTerm: preview.expectedShortTerm,
      expectedLongTerm: preview.expectedLongTerm,
      affectedCivsLikely: estimateAffectedCivs(engine.state.civs.size, effective.category),
      sandbox: preview.sandbox,
    };
  }

  /**
   * Stage 2: the user confirms an origin — the element enters the world and we
   * fast-forward a few ticks so its first effects are immediately visible.
   */
  async confirm(userId: string, contributionId: string, originIndex: number, locale: Locale) {
    const contribution = await this.prisma.userContribution.findUnique({ where: { id: contributionId } });
    if (!contribution || contribution.userId !== userId) throw new NotFoundException("contribution not found");
    if (contribution.status !== "preview") throw new BadRequestException(`contribution is ${contribution.status}, expected preview`);
    const engine = this.manager.get(contribution.planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    const parsed = contribution.parsed as unknown as import("@kawkab/shared-types").ParsedContribution;
    if (originIndex < 0 || originIndex >= engine.state.cells.length) throw new BadRequestException("invalid origin index");

    const statsBefore = engine.getStats();
    const eventsBefore = engine.events.length;
    await this.manager.addContribution(contribution.planetId, {
      id: contribution.id,
      userId,
      parsed,
      originIndex,
    });
    // initial simulation burst so the world visibly reacts now
    const deltas = await this.manager.runTicks(contribution.planetId, 5);
    const newEvents = engine.events.slice(eventsBefore);
    const statsAfter = engine.getStats();
    const rootEventId = engine.getContributionRoot(contribution.id);

    const region = engine.getRegion(originIndex)!;
    await this.prisma.userContribution.update({
      where: { id: contribution.id },
      data: {
        status: "active",
        originIndex,
        originLat: region.lat,
        originLon: region.lon,
        rootEventKey: rootEventId,
        createdTick: statsBefore.tick,
        eventCount: newEvents.length,
      },
    });
    await this.prisma.profile.update({
      where: { userId },
      data: { totalContributions: { increment: 1 }, totalEffects: { increment: newEvents.length } },
    });

    this.bus.publish("contribution.applied", { planetId: contribution.planetId, contributionId: contribution.id, userId, rootEventId });

    const facts = buildFacts(deltas.flatMap((d) => [d]), statsBefore, statsAfter, newEvents, parsed.category);
    const narration = await this.ai.narrate({ events: newEvents, facts, locale, userId });

    return {
      contributionId: contribution.id,
      rootEventId,
      appliedAtTick: statsBefore.tick,
      events: newEvents,
      narration: narration.text,
      grounded: narration.grounded,
      sandbox: narration.sandbox,
      facts,
    };
  }

  async mine(userId: string) {
    return this.prisma.userContribution.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async detail(userId: string, id: string) {
    const c = await this.prisma.userContribution.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("contribution not found");
    const engine = this.manager.get(c.planetId);
    const trace = engine?.getContributionTrace(id) ?? null;
    const events = engine?.getEvents({ contributionId: id, limit: 100 }) ?? [];
    return { ...c, trace, events };
  }

  async causalTrace(id: string) {
    const c = await this.prisma.userContribution.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("contribution not found");
    const engine = this.manager.get(c.planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");
    const trace = engine.getContributionTrace(id);
    if (!trace) throw new NotFoundException("no causal trace yet — the element may not have been confirmed");
    const root = engine.getContributionRoot(id);
    const byId = new Map(engine.events.map((e) => [e.id, e]));
    const hydrate = (node: import("@kawkab/shared-types").CausalNode): unknown => ({
      event: byId.get(node.eventId) ?? { id: node.eventId },
      depth: node.depth,
      children: node.children.map(hydrate),
    });
    return { rootEventId: root, totalDescendants: trace.totalDescendants, tree: hydrate(trace.nodes) };
  }

  /** Monte-Carlo futures for a confirmed contribution */
  async scenarios(userId: string, id: string, locale: Locale): Promise<ScenarioReport> {
    const c = await this.prisma.userContribution.findUnique({ where: { id } });
    if (!c || c.userId !== userId) throw new NotFoundException("contribution not found");
    if (c.status !== "active") throw new BadRequestException("scenarios require an active contribution");
    const engine = this.manager.get(c.planetId);
    if (!engine) throw new ServiceUnavailableException("planet engine is not loaded");

    const reports = runScenarioSet(engine, [1, 10, 100, 1000], 7);
    const horizons: ScenarioReport["horizons"] = [];
    for (const r of reports) {
      const median = r.runs[Math.floor(r.runs.length / 2)]!;
      const best = r.runs[r.runs.length - 1]!;
      const worst = r.runs[0]!;
      const mkFacts = (run: typeof median): NarrationFact[] => [
        { key: "yearsElapsed", value: r.yearsAhead },
        { key: "populationTotal", value: run.endStats.totalPopulation },
        { key: "civilizationsAlive", value: run.endStats.civilizations },
        { key: "speciesAlive", value: run.biodiversity },
        { key: "warsCaused", value: run.warsFought },
      ];
      const [likely, bestText, worstText] = await Promise.all([
        this.ai.narrate({ events: [], facts: mkFacts(median), locale, userId }),
        this.ai.narrate({ events: [], facts: mkFacts(best), locale, userId }),
        this.ai.narrate({ events: [], facts: mkFacts(worst), locale, userId }),
      ]);
      horizons.push({
        yearsAhead: r.yearsAhead,
        targetTick: engine.state.tick + r.ticksRun,
        runs: r.runs.length,
        mostLikely: likely.text,
        bestCase: bestText.text,
        worstCase: worstText.text,
        uncertainty: r.uncertainty,
        drivers: r.drivers,
        scoreDistribution: { p10: r.scoreP10, p50: r.scoreP50, p90: r.scoreP90 },
      });
    }
    return { contributionId: id, horizons, generatedAtTick: engine.state.tick };
  }
}

function computeSuccessProbability(acceptable: boolean, origins: { score: number }[], riskCount: number): number {
  if (!acceptable) return 0.15;
  const best = origins[0]?.score ?? 0;
  return Math.round(Math.min(0.97, Math.max(0.1, 0.35 + best * 0.55 - riskCount * 0.04)) * 100) / 100;
}

function estimateAffectedCivs(totalCivs: number, category: string): number {
  switch (category) {
    case "civilization": return Math.min(totalCivs, 3);
    case "world_law": return totalCivs;
    case "disease": return Math.min(totalCivs, 5);
    case "invention": return Math.min(totalCivs, 4);
    default: return Math.min(totalCivs, 2);
  }
}

function buildFacts(
  deltas: import("@kawkab/shared-types").WorldDelta[],
  before: import("@kawkab/shared-types").PlanetStats,
  after: import("@kawkab/shared-types").PlanetStats,
  events: import("@kawkab/shared-types").WorldEvent[],
  category: string,
): NarrationFact[] {
  const facts: NarrationFact[] = [{ key: "yearsElapsed", value: after.simYear - before.simYear }];
  const pollutionDelta = (after.meanPollution - before.meanPollution) * 100;
  if (Math.abs(pollutionDelta) >= 0.05) {
    facts.push({ key: "pollutionDeltaPct", value: Math.round(pollutionDelta * 10) / 10, unit: "%" });
  }
  const civActors = new Set<string>();
  for (const ev of events) {
    for (const a of ev.actorIds) if (a.startsWith("cv_")) civActors.add(a);
  }
  facts.push({ key: "civsAffected", value: civActors.size });
  const wars = events.filter((e) => e.type === "WAR_STARTED").length;
  facts.push({ key: "warsCaused", value: wars });
  const extinctions = events.filter((e) => e.type === "SPECIES_EXTINCT").length;
  facts.push({ key: "extinctions", value: extinctions });
  const spreadRegions = events.filter((e) => e.type === "PLANTS_SPREAD" || e.type === "SPECIES_MIGRATED").length;
  if (category === "plant" || category === "creature") facts.push({ key: "spreadRegions", value: Math.max(1, spreadRegions) });
  return facts;
}
