import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { UserRole } from "@kawkab/shared-types";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators.js";
import { PrismaService } from "../common/prisma.service.js";
import { WorldManager } from "../worlds/world-manager.js";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: WorldManager,
  ) {}

  @Roles("MODERATOR", "SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Get("overview")
  async overview() {
    const [users, planets, contributions, events, aiCost, pendingModeration] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.planet.count(),
      this.prisma.userContribution.count(),
      this.prisma.worldEvent.count(),
      this.prisma.aIRequest.aggregate({ _sum: { costUsd: true, tokensIn: true, tokensOut: true } }),
      this.prisma.moderationResult.count({ where: { status: { in: ["flagged", "pending"] } } }),
    ]);
    return {
      users,
      planets,
      contributions,
      events,
      ai: { costUsd: aiCost._sum.costUsd ?? 0, tokensIn: aiCost._sum.tokensIn ?? 0, tokensOut: aiCost._sum.tokensOut ?? 0 },
      pendingModeration,
    };
  }

  @Roles("SYS_ADMIN", "SUPER_ADMIN")
  @Get("users")
  async users(@Query("page") page?: string, @Query("q") q?: string) {
    const p = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { displayName: { contains: q, mode: "insensitive" as const } }] } : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, email: true, displayName: true, role: true, locale: true, createdAt: true, lastLoginAt: true, bannedAt: true, _count: { select: { contributions: true } } },
        orderBy: { createdAt: "desc" },
        skip: (p - 1) * 25,
        take: 25,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: p };
  }

  @Roles("SUPER_ADMIN")
  @Patch("users/:id/role")
  async setRole(@Param("id") id: string, @Body() body: { role: UserRole }, @CurrentUser() actor: AuthUser) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException("user not found");
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { role: body.role } }),
      this.prisma.role.upsert({
        where: { userId_role: { userId: id, role: body.role } },
        create: { userId: id, role: body.role, grantedBy: actor.id },
        update: {},
      }),
    ]);
    return { ok: true };
  }

  @Roles("SYS_ADMIN", "SUPER_ADMIN")
  @Patch("users/:id/ban")
  async setBan(@Param("id") id: string, @Body() body: { banned: boolean }) {
    await this.prisma.user.update({ where: { id }, data: { bannedAt: body.banned ? new Date() : null } });
    return { ok: true };
  }

  @Roles("MODERATOR", "SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Get("ai-usage")
  async aiUsage(@Query("days") days?: string) {
    const d = Math.min(90, parseInt(days ?? "7", 10) || 7);
    const since = new Date(Date.now() - d * 86_400_000);
    const rows = await this.prisma.aIRequest.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 500 });
    const total = rows.reduce((s, r) => s + r.costUsd, 0);
    return { totalCostUsd: total, rows };
  }

  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Get("simulations")
  async simulations() {
    const planets = await this.prisma.planet.findMany({ select: { id: true, name: true, status: true, tick: true, simYear: true } });
    return planets.map((p) => ({ ...p, live: this.manager.status(p.id) }));
  }

  @Roles("SYS_ADMIN", "SUPER_ADMIN")
  @Get("audit-logs")
  async auditLogs(@Query("page") page?: string) {
    const p = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (p - 1) * 50, take: 50 }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page: p };
  }

  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Get("contributions")
  async contributions(@Query("status") status?: string) {
    return this.prisma.userContribution.findMany({
      where: status ? { status: status as never } : {},
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Get("ticks/:planetId")
  async tickMetrics(@Param("planetId") planetId: string, @Query("limit", new ParseIntPipe({ optional: true })) limit?: number) {
    return this.prisma.simulationTick.findMany({
      where: { planetId },
      orderBy: { tick: "desc" },
      take: Math.min(500, limit ?? 100),
      select: { tick: true, simYear: true, durationMs: true, eventCount: true, createdAt: true },
    });
  }
}
