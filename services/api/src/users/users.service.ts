import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        level: true,
        xp: true,
        locale: true,
        avatarUrl: true,
        profile: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async getImpact(userId: string) {
    const [elementsAdded, totalImpacts, lastEvent, civilizationsAffected] =
      await Promise.all([
        this.prisma.userContribution.count({
          where: { userId, status: "applied" },
        }),
        this.prisma.worldEvent.count({ where: { userId } }),
        this.prisma.worldEvent.findFirst({
          where: { userId },
          orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
          select: { title: true, titleAr: true },
        }),
        this.prisma.worldEvent
          .findMany({
            where: {
              userId,
              type: { in: ["CIVILIZATION_FOUNDED", "CITY_CREATED", "WAR_STARTED"] },
            },
            distinct: ["planetId"],
            select: { planetId: true },
          })
          .then((rows) => rows.length),
      ]);

    return {
      elementsAdded,
      totalImpacts,
      evolutionDays: totalImpacts,
      civilizationsAffected,
      lastEventTitle: lastEvent?.title,
      lastEventTitleAr: lastEvent?.titleAr,
    };
  }
}
