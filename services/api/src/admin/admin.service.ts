import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      users,
      planets,
      pendingContributions,
      appliedContributions,
      events,
      moderationRejected,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.planet.count(),
      this.prisma.userContribution.count({ where: { status: "pending" } }),
      this.prisma.userContribution.count({ where: { status: "applied" } }),
      this.prisma.worldEvent.count(),
      this.prisma.moderationResult.count({ where: { allowed: false } }),
    ]);

    return {
      users,
      planets,
      pendingContributions,
      appliedContributions,
      events,
      moderationRejected,
    };
  }

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        level: true,
        xp: true,
        locale: true,
        createdAt: true,
      },
      take: 200,
    });
  }

  listAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  listModerationResults() {
    return this.prisma.moderationResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
