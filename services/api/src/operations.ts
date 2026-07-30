import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { Prisma, prisma, type StaffRole } from "@e3lani/database";
import { analyticsEventSchema, updatePriceSchema } from "@e3lani/types";
import { CurrentUser, type AuthUser, parse, Roles } from "./common";

const allStaff: StaffRole[] = [
  "SUPER_ADMIN",
  "ADS_MODERATOR",
  "SUPPORT",
  "CAMPAIGN_MANAGER",
  "FINANCE_MANAGER",
  "CONTENT_MANAGER"
];

@Injectable()
export class OperationsService {
  async recordEvent(userId: string, body: unknown) {
    const input = parse(analyticsEventSchema, body);
    const ad = await prisma.ad.findUnique({ where: { id: input.adId }, select: { ownerId: true } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    if (ad.ownerId === userId) return { accepted: true, counted: false };
    await prisma.analyticsEvent.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: {
        adId: input.adId,
        userId,
        type: input.type,
        watchMs: input.watchMs,
        cityId: input.cityId,
        source: input.source,
        idempotencyKey: input.idempotencyKey
      }
    });
    return { accepted: true, counted: true };
  }

  async ownerAnalytics(userId: string, adId: string) {
    const ad = await prisma.ad.findFirst({ where: { id: adId, ownerId: userId } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    const grouped = await prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: { adId },
      _count: { id: true },
      _sum: { watchMs: true }
    });
    const uniqueReach = await prisma.analyticsEvent.findMany({
      where: { adId, type: "IMPRESSION" },
      distinct: ["userId"],
      select: { userId: true }
    });
    const cities = await prisma.analyticsEvent.groupBy({
      by: ["cityId"],
      where: { adId, cityId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5
    });
    return { events: grouped, uniqueReach: uniqueReach.length, topCities: cities };
  }

  notifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async adminDashboard() {
    const [users, activeAds, openReports, activeBanners, paidVolume] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.ad.count({ where: { status: "ACTIVE" } }),
      prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING", "APPEALED"] } } }),
      prisma.bannerRequest.count({ where: { status: "ACTIVE" } }),
      prisma.paymentOrder.aggregate({ where: { status: "PAID" }, _sum: { totalHalalas: true } })
    ]);
    return { users, activeAds, openReports, activeBanners, paidVolumeHalalas: paidVolume._sum.totalHalalas ?? 0 };
  }

  users(query?: string) {
    return prisma.user.findMany({
      where: query
        ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }] }
        : undefined,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        accountType: true,
        status: true,
        staffRole: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  ads(status?: Prisma.EnumAdStatusFilter["equals"]) {
    return prisma.ad.findMany({
      where: status ? { status } : undefined,
      include: { owner: { select: { id: true, name: true, phone: true } }, category: true, city: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  reports() {
    return prisma.report.findMany({
      include: {
        reporter: { select: { id: true, name: true, phone: true } },
        ad: { select: { id: true, title: true, ownerId: true, status: true } },
        appeals: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async actOnReport(
    actor: AuthUser,
    reportId: string,
    body: { action?: string; reason?: string }
  ) {
    if (!["DISMISS", "PAUSE", "REMOVE", "REACTIVATE"].includes(body.action ?? "") || !body.reason) {
      throw new BadRequestException("ACTION_AND_REASON_REQUIRED");
    }
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { ad: true }
    });
    if (!report) throw new NotFoundException("REPORT_NOT_FOUND");
    const nextStatus =
      body.action === "REMOVE" ? "REMOVED" : body.action === "PAUSE" ? "PAUSED" : body.action === "REACTIVATE" ? "ACTIVE" : report.ad.status;
    return prisma.$transaction(async (tx) => {
      if (body.action !== "DISMISS") {
        await tx.ad.update({ where: { id: report.adId }, data: { status: nextStatus } });
      }
      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          status: body.action === "DISMISS" ? "DISMISSED" : "ACTIONED",
          actionById: actor.id,
          actionReason: body.reason,
          reviewedAt: new Date()
        }
      });
      await tx.notification.create({
        data: {
          userId: report.ad.ownerId,
          type: "REPORT_DECISION",
          titleAr: "قرار بشأن بلاغ",
          titleEn: "Report decision",
          bodyAr: body.reason,
          bodyEn: body.reason,
          data: { reportId, adId: report.adId, action: body.action }
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: `REPORT_${body.action}`,
          entityType: "Report",
          entityId: reportId,
          before: { reportStatus: report.status, adStatus: report.ad.status },
          after: { reportStatus: updated.status, adStatus: nextStatus, reason: body.reason }
        }
      });
      return updated;
    });
  }

  prices() {
    return prisma.price.findMany({ orderBy: { code: "asc" } });
  }

  async updatePrice(actor: AuthUser, code: string, body: unknown) {
    const input = parse(updatePriceSchema, body);
    const previous = await prisma.price.findUnique({ where: { code } });
    if (!previous) throw new NotFoundException("PRICE_NOT_FOUND");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.price.update({
        where: { code },
        data: { amountHalalas: input.amountHalalas, active: input.active, version: { increment: 1 } }
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "PRICE_UPDATED",
          entityType: "Price",
          entityId: previous.id,
          before: { amountHalalas: previous.amountHalalas, active: previous.active },
          after: { amountHalalas: updated.amountHalalas, active: updated.active }
        }
      });
      return updated;
    });
  }

  audit() {
    return prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 250
    });
  }

  banners() {
    return prisma.bannerRequest.findMany({
      include: { owner: { select: { id: true, name: true } }, media: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async reviewBanner(actor: AuthUser, id: string, approved: boolean, reason?: string) {
    if (!approved && !reason) throw new BadRequestException("REJECTION_REASON_REQUIRED");
    const banner = await prisma.bannerRequest.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException("BANNER_NOT_FOUND");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.bannerRequest.update({
        where: { id },
        data: approved
          ? {
              status: "ACTIVE",
              startsAt: new Date(),
              endsAt: new Date(Date.now() + 30 * 86_400_000),
              reviewReason: null
            }
          : { status: "REJECTED", reviewReason: reason }
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: approved ? "BANNER_APPROVED" : "BANNER_REJECTED",
          entityType: "BannerRequest",
          entityId: id,
          before: { status: banner.status },
          after: { status: updated.status, reason }
        }
      });
      return updated;
    });
  }
}

@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Post("analytics/events")
  event(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.operations.recordEvent(user.id, body);
  }

  @Get("ads/:id/analytics")
  analytics(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.operations.ownerAnalytics(user.id, id);
  }

  @Get("notifications")
  notifications(@CurrentUser() user: AuthUser) {
    return this.operations.notifications(user.id);
  }
}

@Roles(...allStaff)
@Controller("admin")
export class AdminController {
  constructor(private readonly operations: OperationsService) {}

  @Get("dashboard")
  dashboard() {
    return this.operations.adminDashboard();
  }

  @Roles("SUPER_ADMIN", "SUPPORT")
  @Get("users")
  users(@Query("q") q?: string) {
    return this.operations.users(q);
  }

  @Roles("SUPER_ADMIN", "ADS_MODERATOR", "CONTENT_MANAGER")
  @Get("ads")
  ads(@Query("status") status?: Prisma.EnumAdStatusFilter["equals"]) {
    return this.operations.ads(status);
  }

  @Roles("SUPER_ADMIN", "ADS_MODERATOR", "SUPPORT")
  @Get("reports")
  reports() {
    return this.operations.reports();
  }

  @Roles("SUPER_ADMIN", "ADS_MODERATOR")
  @Post("reports/:id/action")
  reportAction(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { action?: string; reason?: string }
  ) {
    return this.operations.actOnReport(user, id, body);
  }

  @Roles("SUPER_ADMIN", "FINANCE_MANAGER")
  @Get("prices")
  prices() {
    return this.operations.prices();
  }

  @Roles("SUPER_ADMIN", "FINANCE_MANAGER")
  @Patch("prices/:code")
  price(@CurrentUser() user: AuthUser, @Param("code") code: string, @Body() body: unknown) {
    return this.operations.updatePrice(user, code, body);
  }

  @Roles("SUPER_ADMIN", "CAMPAIGN_MANAGER")
  @Get("banners")
  banners() {
    return this.operations.banners();
  }

  @Roles("SUPER_ADMIN", "CAMPAIGN_MANAGER")
  @Post("banners/:id/review")
  reviewBanner(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { approved?: boolean; reason?: string }
  ) {
    return this.operations.reviewBanner(user, id, body.approved === true, body.reason);
  }

  @Roles("SUPER_ADMIN")
  @Get("audit")
  audit() {
    return this.operations.audit();
  }
}
