import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { WorldEvent } from "@planet/shared-types";
import { ContributionStatus } from "@planet/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { EngineClient } from "../common/engine.client.js";
import { OrchestratorClient } from "../common/orchestrator.client.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { globalRateLimiter } from "../common/rate-limit.js";
import { config } from "../config.js";

/**
 * The contribution pipeline:
 * draft -> AI analysis (+moderation +balance) -> region pick -> Monte-Carlo
 * preview -> confirm -> engine applies -> events persist -> user notified.
 */
@Injectable()
export class ContributionsService {
  constructor(
    private prisma: PrismaService,
    private engine: EngineClient,
    private orchestrator: OrchestratorClient,
    private worlds: WorldsService,
    private notifications: NotificationsService,
  ) {}

  async createDraft(userId: string, input: { category: string; text: string; worldId: string }) {
    const allowed = globalRateLimiter.allow(
      `contribution:${userId}`,
      config.contributionRateLimitPerHour,
      3600_000,
    );
    if (!allowed) throw new UnprocessableEntityException("contribution_rate_limit_exceeded");

    const draft = await this.prisma.userContribution.create({
      data: {
        userId,
        planetId: input.worldId,
        category: input.category,
        rawText: input.text,
        status: ContributionStatus.Draft,
      },
    });
    return draft;
  }

  /** Stage 3-6: AI analysis -> structured traits -> balance -> preview data. */
  async analyze(userId: string, contributionId: string, locale: string) {
    const draft = await this.owned(userId, contributionId);
    const started = Date.now();
    try {
      const result = await this.orchestrator.analyze({
        category: draft.category,
        text: draft.rawText,
        locale,
        userId,
      });
      const analysis = result.analysis as { sandbox?: boolean };
      await this.prisma.aIRequest.create({
        data: {
          userId,
          provider: analysis?.sandbox ? "mock" : "live",
          kind: "analyze",
          sandbox: analysis?.sandbox ?? true,
          durationMs: Date.now() - started,
          status: "ok",
        },
      });
      const moderation = (result.moderation ?? { flags: [] }) as { flags: string[] };
      if (moderation.flags.length > 0) {
        await this.prisma.moderationResult.create({
          data: { userId, contributionId, flags: moderation.flags, score: 0.6, allowed: true },
        });
      }
      const updated = await this.prisma.userContribution.update({
        where: { id: contributionId },
        data: {
          analysis: result.analysis as object,
          balance: result.balance as object,
          status: ContributionStatus.Analyzing,
        },
      });
      return { contribution: updated, analysis: result.analysis, balance: result.balance };
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 422) {
        await this.prisma.userContribution.update({
          where: { id: contributionId },
          data: { status: ContributionStatus.Rejected },
        });
        await this.prisma.moderationResult.create({
          data: { userId, contributionId, flags: ["moderation_blocked"], score: 1, allowed: false },
        });
        throw new UnprocessableEntityException("moderation_blocked");
      }
      throw err;
    }
  }

  /** Stage 8-9: Monte-Carlo future preview at the chosen region. */
  async preview(userId: string, contributionId: string, cellIndex: number) {
    const draft = await this.owned(userId, contributionId);
    if (!draft.analysis) throw new UnprocessableEntityException("analyze_first");
    await this.worlds.ensureEngineWorld(draft.planetId);
    const preview = await this.engine.previewContribution(draft.planetId, {
      contributionId: draft.id,
      analysis: draft.analysis,
      cellIndex,
    });
    await this.prisma.userContribution.update({
      where: { id: contributionId },
      data: { preview: preview as object, cellIndex, status: ContributionStatus.Previewed },
    });
    return preview;
  }

  /** Stage 10-12: apply to the live world, persist consequences, notify. */
  async confirm(userId: string, contributionId: string) {
    const draft = await this.owned(userId, contributionId);
    if (!draft.analysis || draft.cellIndex === null || draft.cellIndex === undefined) {
      throw new UnprocessableEntityException("preview_first");
    }
    const balance = draft.balance as { verdict?: string } | null;
    if (balance?.verdict === "reject") {
      throw new UnprocessableEntityException("contribution_rejected_by_balance");
    }
    // When the balance layer adjusted traits, apply the adjusted version.
    const adjusted = (balance?.verdict === "adjust"
      ? { ...(draft.analysis as Record<string, unknown>), traits: (balance as { adjustedTraits?: unknown }).adjustedTraits ?? (draft.analysis as Record<string, unknown>)["traits"] }
      : draft.analysis) as object;

    await this.worlds.ensureEngineWorld(draft.planetId);
    const result = await this.engine.applyContribution(draft.planetId, {
      contributionId: draft.id,
      analysis: adjusted,
      cellIndex: draft.cellIndex,
      runTicks: 12,
    });

    const contributionEvents = (result.contributionEvents ?? []) as WorldEvent[];
    const newEvents = (result.newEvents ?? []) as WorldEvent[];
    await this.worlds.persistEvents(draft.planetId, [...contributionEvents, ...newEvents]);
    await this.prisma.planet.update({
      where: { id: draft.planetId },
      data: { currentTick: result.tick },
    });

    const impactScore = computeImpactScore(contributionEvents);
    const updated = await this.prisma.userContribution.update({
      where: { id: contributionId },
      data: {
        status: ContributionStatus.Applied,
        appliedTick: result.tick,
        impactScore,
        eventCount: contributionEvents.length,
      },
    });
    await this.prisma.profile.update({
      where: { userId },
      data: { impactScore: { increment: impactScore } },
    });

    const root = result.rootEvent as WorldEvent | undefined;
    if (root) {
      await this.notifications.create({
        userId,
        planetId: draft.planetId,
        type: "contribution.applied",
        title: "contribution_applied",
        body: JSON.stringify({ name: (draft.analysis as { name?: string }).name, tick: result.tick }),
        eventSeq: root.seq,
      });
    }
    for (const event of [...contributionEvents, ...newEvents].slice(-20)) {
      this.worlds.broadcastEvent(draft.planetId, event);
    }
    return { contribution: updated, rootEvent: root, contributionEvents };
  }

  async mine(userId: string, planetId?: string) {
    return this.prisma.userContribution.findMany({
      where: { userId, ...(planetId ? { planetId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async impact(userId: string, contributionId: string) {
    const draft = await this.owned(userId, contributionId);
    const events = await this.prisma.worldEvent.findMany({
      where: { planetId: draft.planetId, contributionId: draft.id },
      orderBy: { seq: "asc" },
      take: 500,
    });
    return { contribution: draft, events };
  }

  private async owned(userId: string, contributionId: string) {
    const draft = await this.prisma.userContribution.findUnique({ where: { id: contributionId } });
    if (!draft || draft.userId !== userId) throw new NotFoundException("contribution_not_found");
    return draft;
  }
}

function computeImpactScore(events: WorldEvent[]): number {
  let score = 0;
  for (const e of events) score += e.importance;
  return Math.round(score * 100) / 100;
}
