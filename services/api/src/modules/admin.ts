import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import { z } from "zod";

import { Role } from "@e3lani/database";

import { CurrentUser, type AuthUser, parseInput, PrismaService, Roles } from "../common";

const staffRoles = [
  Role.MODERATOR,
  Role.SUPPORT,
  Role.CAMPAIGN_MANAGER,
  Role.FINANCE,
  Role.CONTENT_MANAGER,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const reportActionSchema = z.object({
  action: z.enum(["DISMISS", "PAUSE", "REMOVE", "REACTIVATE"]),
  reason: z.string().trim().min(5).max(500),
});
const priceSchema = z.object({
  priceHalalas: z.number().int().min(0).max(10_000_000),
  durationDays: z.number().int().min(1).max(365).nullable().optional(),
  reason: z.string().trim().min(5).max(500),
});
const settingSchema = z.object({
  value: z.unknown(),
  reason: z.string().trim().min(5).max(500),
});
const userStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().trim().min(5).max(500),
});
const tickerActionSchema = z.object({
  status: z.enum(["APPROVED", "ACTIVE", "REJECTED", "PAUSED"]),
  reason: z.string().trim().min(5).max(500),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, activeAds, posts, openReports, pendingTicker, payments] = await Promise.all([
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
      this.prisma.adDistribution.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } }),
      this.prisma.profilePost.count({ where: { status: "PUBLISHED" } }),
      this.prisma.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW", "APPEALED"] } } }),
      this.prisma.tickerRequest.count({ where: { status: "PENDING_REVIEW" } }),
      this.prisma.payment.aggregate({
        where: { status: "CAPTURED" },
        _sum: { amountHalalas: true },
      }),
    ]);
    return {
      users,
      activeAds,
      profilePosts: posts,
      openReports,
      pendingTicker,
      capturedRevenueHalalas: payments._sum.amountHalalas ?? 0,
    };
  }

  users(rawQuery: unknown) {
    const query = parseInput(paginationSchema, rawQuery);
    return this.prisma.user.findMany({
      where: query.cursor ? { id: { lt: query.cursor } } : undefined,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: { profile: { include: { city: true } }, roles: true, businessProfile: true },
    });
  }

  reports(rawQuery: unknown) {
    const query = parseInput(paginationSchema, rawQuery);
    return this.prisma.report.findMany({
      where: query.cursor ? { id: { lt: query.cursor } } : undefined,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { include: { profile: true } },
        distribution: { include: { post: true, owner: { include: { profile: true } } } },
        actions: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async actOnReport(actor: AuthUser, reportId: string, rawInput: unknown) {
    const input = parseInput(reportActionSchema, rawInput);
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { distribution: true },
    });
    if (!report) throw new BadRequestException("REPORT_NOT_FOUND");
    const status =
      input.action === "DISMISS"
        ? "DISMISSED"
        : input.action === "REACTIVATE"
          ? "ACTIONED"
          : "ACTIONED";
    const distributionStatus =
      input.action === "PAUSE"
        ? "PAUSED"
        : input.action === "REMOVE"
          ? "REMOVED"
          : input.action === "REACTIVATE"
            ? "ACTIVE"
            : report.distribution.status;
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id: reportId },
        data: {
          status,
          resolution: input.reason,
          actions: {
            create: { actorId: actor.id, action: input.action, reason: input.reason },
          },
        },
      });
      if (distributionStatus !== report.distribution.status) {
        await transaction.adDistribution.update({
          where: { id: report.distributionId },
          data: { status: distributionStatus },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: `REPORT_${input.action}`,
          entityType: "Report",
          entityId: report.id,
          reason: input.reason,
          before: { reportStatus: report.status, distributionStatus: report.distribution.status },
          after: { reportStatus: status, distributionStatus },
        },
      });
      await transaction.notification.create({
        data: {
          userId: report.distribution.ownerId,
          type: "REPORT_DECISION",
          titleAr: "تحديث على بلاغ إعلانك",
          titleEn: "Report decision update",
          bodyAr: input.reason,
          bodyEn: input.reason,
          data: { reportId: report.id, action: input.action },
        },
      });
      return updated;
    });
  }

  pricing() {
    return this.prisma.pricingVersion.findMany({
      orderBy: { version: "desc" },
      include: { rules: { orderBy: { code: "asc" } } },
    });
  }

  async updatePrice(actor: AuthUser, ruleId: string, rawInput: unknown) {
    const input = parseInput(priceSchema, rawInput);
    const before = await this.prisma.pricingRule.findUnique({ where: { id: ruleId } });
    if (!before) throw new BadRequestException("PRICING_RULE_NOT_FOUND");
    return this.prisma.$transaction(async (transaction) => {
      const after = await transaction.pricingRule.update({
        where: { id: ruleId },
        data: { priceHalalas: input.priceHalalas, durationDays: input.durationDays },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: "PRICING_RULE_UPDATED",
          entityType: "PricingRule",
          entityId: ruleId,
          reason: input.reason,
          before,
          after,
        },
      });
      return after;
    });
  }

  settings() {
    return this.prisma.appSetting.findMany({ orderBy: { key: "asc" } });
  }

  async updateSetting(actor: AuthUser, key: string, rawInput: unknown) {
    const input = parseInput(settingSchema, rawInput);
    if (key === "payments.enabled" && input.value === true && process.env.PAYMENT_PROVIDER === "disabled") {
      throw new BadRequestException("CONFIGURE_REAL_PAYMENT_PROVIDER_FIRST");
    }
    if (key === "platform.mode" && !["PROFILE_ONLY", "FREE_LAUNCH", "PAID_ONLY"].includes(String(input.value))) {
      throw new BadRequestException("INVALID_LAUNCH_MODE");
    }
    const before = await this.prisma.appSetting.findUnique({ where: { key } });
    return this.prisma.$transaction(async (transaction) => {
      const after = await transaction.appSetting.upsert({
        where: { key },
        update: { value: input.value as object, updatedById: actor.id },
        create: { key, value: input.value as object, updatedById: actor.id },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: "APP_SETTING_UPDATED",
          entityType: "AppSetting",
          entityId: key,
          reason: input.reason,
          before: before?.value as object,
          after: after.value as object,
        },
      });
      return after;
    });
  }

  async updateUserStatus(actor: AuthUser, userId: string, rawInput: unknown) {
    const input = parseInput(userStatusSchema, rawInput);
    if (actor.id === userId && input.status === "SUSPENDED") {
      throw new BadRequestException("CANNOT_SUSPEND_SELF");
    }
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.prisma.$transaction(async (transaction) => {
      const after = await transaction.user.update({ where: { id: userId }, data: { status: input.status } });
      if (input.status === "SUSPENDED") {
        await transaction.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: `USER_${input.status}`,
          entityType: "User",
          entityId: userId,
          reason: input.reason,
          before: { status: before.status },
          after: { status: after.status },
        },
      });
      return after;
    });
  }

  ticker() {
    return this.prisma.tickerRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: { include: { profile: true } }, logoMedia: true },
    });
  }

  async updateTicker(actor: AuthUser, id: string, rawInput: unknown) {
    const input = parseInput(tickerActionSchema, rawInput);
    const before = await this.prisma.tickerRequest.findUniqueOrThrow({ where: { id } });
    return this.prisma.$transaction(async (transaction) => {
      const after = await transaction.tickerRequest.update({
        where: { id },
        data: {
          status: input.status,
          reason: input.reason,
          startsAt: input.startsAt ? new Date(input.startsAt) : before.startsAt,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : before.expiresAt,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: `TICKER_${input.status}`,
          entityType: "TickerRequest",
          entityId: id,
          reason: input.reason,
          before: { status: before.status },
          after: { status: after.status },
        },
      });
      return after;
    });
  }

  audit(rawQuery: unknown) {
    const query = parseInput(paginationSchema, rawQuery);
    return this.prisma.auditLog.findMany({
      where: query.cursor ? { id: { lt: query.cursor } } : undefined,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: { actor: { include: { profile: true } } },
    });
  }

  payments(rawQuery: unknown) {
    const query = parseInput(paginationSchema, rawQuery);
    return this.prisma.payment.findMany({
      where: query.cursor ? { id: { lt: query.cursor } } : undefined,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: { order: { include: { user: { include: { profile: true } } } } },
    });
  }
}

@Roles(...staffRoles)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("users")
  users(@Query() query: unknown) {
    return this.admin.users(query);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch("users/:id/status")
  updateUserStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.admin.updateUserStatus(user, id, body);
  }

  @Get("reports")
  reports(@Query() query: unknown) {
    return this.admin.reports(query);
  }

  @Roles(Role.MODERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch("reports/:id")
  actOnReport(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.admin.actOnReport(user, id, body);
  }

  @Get("pricing")
  pricing() {
    return this.admin.pricing();
  }

  @Roles(Role.FINANCE, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch("pricing/:id")
  updatePrice(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.admin.updatePrice(user, id, body);
  }

  @Get("settings")
  settings() {
    return this.admin.settings();
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch("settings/:key")
  updateSetting(@CurrentUser() user: AuthUser, @Param("key") key: string, @Body() body: unknown) {
    return this.admin.updateSetting(user, key, body);
  }

  @Get("ticker")
  ticker() {
    return this.admin.ticker();
  }

  @Roles(Role.CAMPAIGN_MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch("ticker/:id")
  updateTicker(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.admin.updateTicker(user, id, body);
  }

  @Get("payments")
  payments(@Query() query: unknown) {
    return this.admin.payments(query);
  }

  @Get("audit")
  audit(@Query() query: unknown) {
    return this.admin.audit(query);
  }
}
