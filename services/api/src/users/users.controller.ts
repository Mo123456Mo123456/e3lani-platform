import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { UserDashboard } from "@kawkab/shared-types";
import { CurrentUser, type AuthUser } from "../common/decorators.js";
import { PrismaService } from "../common/prisma.service.js";

const ACHIEVEMENTS: Array<{ key: string; when: (s: { contributions: number; effects: number }) => boolean }> = [
  { key: "first_spark", when: (s) => s.contributions >= 1 },
  { key: "life_maker", when: (s) => s.contributions >= 5 },
  { key: "world_shaper", when: (s) => s.effects >= 50 },
  { key: "historian", when: (s) => s.effects >= 200 },
];

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me/dashboard")
  async dashboard(@CurrentUser() user: AuthUser): Promise<UserDashboard> {
    const [profile, contributions] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId: user.id } }),
      this.prisma.userContribution.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    const contributionIds = contributions.map((c) => c.id);
    const recentEvents = contributionIds.length > 0
      ? await this.prisma.worldEvent.findMany({
          where: { contributionId: { in: contributionIds } },
          orderBy: { tick: "desc" },
          take: 20,
        })
      : [];
    const totalEffects = contributions.reduce((s, c) => s + c.eventCount, 0);
    const impactLevel = Math.floor(Math.sqrt(Math.max(0, contributions.reduce((s, c) => s + c.impactScore, 0))));
    const longestImpact = contributions.reduce((s, c) => Math.max(s, c.createdTick ?? 0), 0);
    const affectedCivs = contributionIds.length > 0
      ? await this.prisma.worldEvent
          .findMany({ where: { contributionId: { in: contributionIds } }, select: { actorIds: true }, take: 500 })
          .then((rows) => new Set(rows.flatMap((r) => (r.actorIds as string[]).filter((a) => a.startsWith("cv_")))).size)
      : 0;
    const unlocked = ACHIEVEMENTS.filter((a) => a.when({ contributions: contributions.length, effects: totalEffects }));

    return {
      user: { ...user, avatarUrl: null },
      stats: {
        contributions: contributions.length,
        totalEffects,
        affectedCivilizations: affectedCivs,
        longestImpactYears: longestImpact,
        impactLevel,
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.key, tick: e.tick, simYear: e.simYear, type: e.type as UserDashboard["recentEvents"][0]["type"],
        title: e.title, summary: e.summary,
        region: e.lat !== null && e.lon !== null ? { lat: e.lat, lon: e.lon, index: e.regionIndex ?? undefined } : null,
        actorIds: e.actorIds as string[], causeIds: [], contributionId: e.contributionId,
        confidence: e.confidence, magnitude: e.magnitude, data: e.data as Record<string, number | string | boolean | null>,
      })),
      contributions: contributions.map((c) => ({
        id: c.id,
        name: (c.parsed as { name?: string } | null)?.name ?? c.rawText.slice(0, 40),
        category: c.category as UserDashboard["contributions"][0]["category"],
        status: c.status,
        impactScore: c.impactScore,
        eventCount: c.eventCount,
        lastEventTitle: null,
        createdAt: c.createdAt.toISOString(),
      })),
      achievements: unlocked.map((a) => ({ key: a.key, unlockedAt: new Date().toISOString() })),
    };
  }
}
