import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { adminRoleChangeSchema } from "@planet/validation";
import { PrismaService } from "../prisma/prisma.service.js";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, roleAtLeast } from "../auth/guards.js";
import type { AccessPayload } from "../auth/auth.service.js";
import { OrchestratorClient } from "../common/orchestrator.client.js";
import { EngineClient } from "../common/engine.client.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("content_moderator", "simulation_manager", "system_admin", "super_admin")
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private orchestrator: OrchestratorClient,
    private engine: EngineClient,
    private realtime: RealtimeGateway,
  ) {}

  @Get("overview")
  async overview() {
    const [users, planets, contributions, events, aiCost, moderation] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.planet.count(),
      this.prisma.userContribution.count(),
      this.prisma.worldEvent.count(),
      this.prisma.aIRequest.aggregate({ _sum: { costUsd: true }, _count: true }),
      this.prisma.moderationResult.count({ where: { allowed: false } }),
    ]);
    return {
      users, planets, contributions, events,
      aiRequests: aiCost._count,
      aiCostUsd: aiCost._sum.costUsd ?? 0,
      moderationBlocks: moderation,
      realtimeConnections: this.realtime.connectionCount(),
    };
  }

  @Get("users")
  users(@Query("take") take?: string) {
    return this.prisma.user.findMany({
      take: Math.min(Number(take ?? 50), 200),
      orderBy: { createdAt: "desc" },
      include: { role: true, profile: true, _count: { select: { contributions: true } } },
    });
  }

  @Post("users/role")
  @Roles("system_admin", "super_admin")
  async changeRole(@CurrentUser() actor: AccessPayload, @Body() body: unknown) {
    const parsed = adminRoleChangeSchema.safeParse(body);
    if (!parsed.success) return { error: "invalid_input" };
    const role = await this.prisma.role.findUnique({ where: { name: parsed.data.role } });
    if (!role) return { error: "unknown_role" };
    // No one can grant a role higher than their own.
    if (!roleAtLeast(actor.role, parsed.data.role)) return { error: "cannot_grant_higher_role" };
    const updated = await this.prisma.user.update({
      where: { id: parsed.data.userId },
      data: { roleId: role.id },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.sub,
        action: "admin.change_role",
        targetType: "User",
        targetId: parsed.data.userId,
        metadata: { role: parsed.data.role },
      },
    });
    return { id: updated.id, role: parsed.data.role };
  }

  @Post("users/:id/suspend")
  @Roles("system_admin", "super_admin")
  async suspend(@CurrentUser() actor: AccessPayload, @Param("id") id: string) {
    const updated = await this.prisma.user.update({ where: { id }, data: { status: "suspended" } });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.prisma.auditLog.create({
      data: { userId: actor.sub, action: "admin.suspend_user", targetType: "User", targetId: id, metadata: {} },
    });
    return { id: updated.id, status: updated.status };
  }

  @Get("contributions/review")
  reviewQueue() {
    return this.prisma.userContribution.findMany({
      where: { status: { in: ["draft", "analyzing", "previewed"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true } } },
    });
  }

  @Get("ai-usage")
  aiUsage(@Query("days") days?: string) {
    const since = new Date(Date.now() - Number(days ?? 7) * 24 * 3600 * 1000);
    return this.prisma.aIRequest.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Get("ai-providers")
  aiProviders() {
    return this.orchestrator.providers();
  }

  @Get("audit-logs")
  auditLogs(@Query("take") take?: string) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(take ?? 100), 500),
    });
  }

  @Get("moderation")
  moderation() {
    return this.prisma.moderationResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Get("services/health")
  async serviceHealth() {
    return {
      engine: await this.engine.healthy(),
      orchestrator: await this.orchestrator.healthy(),
      realtimeConnections: this.realtime.connectionCount(),
    };
  }
}
