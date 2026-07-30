import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Roles, CurrentUser, type AuthUser } from "../common/decorators.js";
import { PrismaService } from "../common/prisma.service.js";

@ApiTags("moderation")
@Controller("moderation")
@Roles("MODERATOR", "SYS_ADMIN", "SUPER_ADMIN")
export class ModerationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("queue")
  async queue(@Query("status") status?: string) {
    return this.prisma.moderationResult.findMany({
      where: { status: (status as "flagged" | "pending" | undefined) ?? "flagged" },
      include: { contribution: { include: { user: { select: { id: true, displayName: true, email: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Patch(":id")
  async review(@Param("id") id: string, @Body() body: { status: "approved" | "rejected"; note?: string }, @CurrentUser() user: AuthUser) {
    const result = await this.prisma.moderationResult.update({
      where: { id },
      data: { status: body.status, reviewerId: user.id, reviewedAt: new Date() },
    });
    if (result.contributionId) {
      await this.prisma.userContribution.update({
        where: { id: result.contributionId },
        data: { moderationStatus: body.status, ...(body.status === "rejected" ? { status: "rejected" as const } : {}) },
      });
    }
    return result;
  }
}
