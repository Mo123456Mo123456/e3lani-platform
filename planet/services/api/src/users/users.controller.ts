import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { CurrentUser, JwtAuthGuard } from "../auth/guards.js";
import type { AccessPayload } from "../auth/auth.service.js";

@Controller("users")
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AccessPayload) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      include: {
        role: true,
        profile: true,
        contributions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, category: true, status: true, impactScore: true,
            eventCount: true, appliedTick: true, createdAt: true, planetId: true,
          },
        },
      },
    });
    return {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role.name,
      status: dbUser.status,
      profile: dbUser.profile,
      contributions: dbUser.contributions,
      createdAt: dbUser.createdAt,
    };
  }
}
