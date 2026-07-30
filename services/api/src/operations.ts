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
const jsonSafe = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

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

  async updateUser(
    actor: AuthUser,
    userId: string,
    body: { status?: "ACTIVE" | "SUSPENDED"; staffRole?: StaffRole | null; reason?: string }
  ) {
    if (!body.reason || (!body.status && body.staffRole === undefined)) {
      throw new BadRequestException("USER_CHANGE_REASON_REQUIRED");
    }
    const previous = await prisma.user.findUnique({ where: { id: userId } });
    if (!previous) throw new NotFoundException("USER_NOT_FOUND");
    if (actor.id === userId && body.staffRole !== undefined) {
      throw new BadRequestException("SELF_ROLE_CHANGE_FORBIDDEN");
    }
    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: body.status, staffRole: body.staffRole }
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "USER_ACCESS_UPDATED",
          entityType: "User",
          entityId: userId,
          before: { status: previous.status, staffRole: previous.staffRole },
          after: { status: updated.status, staffRole: updated.staffRole, reason: body.reason }
        }
      });
      return updated;
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

  appeals() {
    return prisma.appeal.findMany({
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        report: { include: { ad: { select: { id: true, title: true, status: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async resolveAppeal(actor: AuthUser, id: string, accepted: boolean, resolution: string) {
    if (resolution.trim().length < 10) throw new BadRequestException("RESOLUTION_REQUIRED");
    const appeal = await prisma.appeal.findUnique({
      where: { id },
      include: { report: { include: { ad: true } } }
    });
    if (!appeal || appeal.status !== "OPEN") throw new NotFoundException("APPEAL_NOT_FOUND");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.appeal.update({
        where: { id },
        data: {
          status: accepted ? "ACCEPTED" : "REJECTED",
          resolution,
          resolvedById: actor.id,
          resolvedAt: new Date()
        }
      });
      if (accepted) {
        await tx.ad.update({
          where: { id: appeal.report.adId },
          data: {
            status: appeal.report.ad.expiresAt && appeal.report.ad.expiresAt > new Date() ? "ACTIVE" : "EXPIRED"
          }
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: accepted ? "APPEAL_ACCEPTED" : "APPEAL_REJECTED",
          entityType: "Appeal",
          entityId: id,
          after: { resolution }
        }
      });
      return updated;
    });
  }

  posts() {
    return prisma.profilePost.findMany({
      include: { owner: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  payments() {
    return prisma.paymentOrder.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: true,
        attempts: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  catalog() {
    return Promise.all([
      prisma.region.findMany({ include: { cities: true }, orderBy: { nameAr: "asc" } }),
      prisma.category.findMany({ include: { children: true }, orderBy: { sortOrder: "asc" } })
    ]).then(([regions, categories]) => ({ regions, categories }));
  }

  async createCategory(
    actor: AuthUser,
    body: { slug?: string; nameAr?: string; nameEn?: string; parentId?: string; sortOrder?: number }
  ) {
    if (!body.slug || !body.nameAr || !body.nameEn || !/^[a-z0-9-]+$/.test(body.slug)) {
      throw new BadRequestException("CATEGORY_FIELDS_INVALID");
    }
    const category = await prisma.category.create({
      data: {
        slug: body.slug,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        parentId: body.parentId,
        sortOrder: body.sortOrder ?? 0
      }
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CATEGORY_CREATED",
        entityType: "Category",
        entityId: category.id,
        after: jsonSafe(category)
      }
    });
    return category;
  }

  async updateCategory(
    actor: AuthUser,
    id: string,
    body: { nameAr?: string; nameEn?: string; sortOrder?: number; active?: boolean }
  ) {
    const previous = await prisma.category.findUnique({ where: { id } });
    if (!previous) throw new NotFoundException("CATEGORY_NOT_FOUND");
    const updated = await prisma.category.update({ where: { id }, data: body });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CATEGORY_UPDATED",
        entityType: "Category",
        entityId: id,
        before: jsonSafe(previous),
        after: jsonSafe(updated)
      }
    });
    return updated;
  }

  async updateCity(
    actor: AuthUser,
    id: string,
    body: { nameAr?: string; nameEn?: string; active?: boolean }
  ) {
    const previous = await prisma.city.findUnique({ where: { id } });
    if (!previous) throw new NotFoundException("CITY_NOT_FOUND");
    const updated = await prisma.city.update({ where: { id }, data: body });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CITY_UPDATED",
        entityType: "City",
        entityId: id,
        before: jsonSafe(previous),
        after: jsonSafe(updated)
      }
    });
    return updated;
  }

  analytics() {
    return Promise.all([
      prisma.analyticsEvent.groupBy({ by: ["type"], _count: { id: true } }),
      prisma.analyticsEvent.groupBy({ by: ["source"], _count: { id: true } }),
      prisma.analyticsEvent.count()
    ]).then(([byType, bySource, total]) => ({ total, byType, bySource }));
  }

  async sendNotification(
    actor: AuthUser,
    body: { userId?: string; titleAr?: string; titleEn?: string; bodyAr?: string; bodyEn?: string }
  ) {
    if (!body.titleAr || !body.titleEn || !body.bodyAr || !body.bodyEn) {
      throw new BadRequestException("NOTIFICATION_FIELDS_REQUIRED");
    }
    const recipients = body.userId
      ? [{ id: body.userId }]
      : await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: "ADMIN_MESSAGE",
        titleAr: body.titleAr as string,
        titleEn: body.titleEn as string,
        bodyAr: body.bodyAr as string,
        bodyEn: body.bodyEn as string
      }))
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "NOTIFICATION_SENT",
        entityType: "Notification",
        after: { recipientCount: recipients.length, targeted: Boolean(body.userId) }
      }
    });
    return { sent: recipients.length };
  }

  async actOnReport(
    actor: AuthUser,
    reportId: string,
    body: { action?: string; reason?: string }
  ) {
    if (!["DISMISS", "PAUSE", "REMOVE", "REACTIVATE"].includes(body.action ?? "") || !body.reason) {
      throw new BadRequestException("ACTION_AND_REASON_REQUIRED");
    }
    const action = body.action as "DISMISS" | "PAUSE" | "REMOVE" | "REACTIVATE";
    const reason = body.reason;
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { ad: true }
    });
    if (!report) throw new NotFoundException("REPORT_NOT_FOUND");
    const nextStatus =
      action === "REMOVE" ? "REMOVED" : action === "PAUSE" ? "PAUSED" : action === "REACTIVATE" ? "ACTIVE" : report.ad.status;
    return prisma.$transaction(async (tx) => {
      if (action !== "DISMISS") {
        await tx.ad.update({ where: { id: report.adId }, data: { status: nextStatus } });
      }
      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          status: action === "DISMISS" ? "DISMISSED" : "ACTIONED",
          actionById: actor.id,
          actionReason: reason,
          reviewedAt: new Date()
        }
      });
      await tx.notification.create({
        data: {
          userId: report.ad.ownerId,
          type: "REPORT_DECISION",
          titleAr: "قرار بشأن بلاغ",
          titleEn: "Report decision",
          bodyAr: reason,
          bodyEn: reason,
          data: { reportId, adId: report.adId, action }
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: `REPORT_${action}`,
          entityType: "Report",
          entityId: reportId,
          before: { reportStatus: report.status, adStatus: report.ad.status },
          after: { reportStatus: updated.status, adStatus: nextStatus, reason }
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
          after: { status: updated.status, reason: reason ?? null }
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

  @Roles("SUPER_ADMIN")
  @Patch("users/:id")
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { status?: "ACTIVE" | "SUSPENDED"; staffRole?: StaffRole | null; reason?: string }
  ) {
    return this.operations.updateUser(user, id, body);
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

  @Roles("SUPER_ADMIN", "ADS_MODERATOR", "SUPPORT")
  @Get("appeals")
  appeals() {
    return this.operations.appeals();
  }

  @Roles("SUPER_ADMIN", "ADS_MODERATOR")
  @Post("appeals/:id/resolve")
  resolveAppeal(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { accepted?: boolean; resolution?: string }
  ) {
    return this.operations.resolveAppeal(user, id, body.accepted === true, body.resolution ?? "");
  }

  @Roles("SUPER_ADMIN", "CONTENT_MANAGER")
  @Get("posts")
  posts() {
    return this.operations.posts();
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
  @Get("payments")
  payments() {
    return this.operations.payments();
  }

  @Roles("SUPER_ADMIN", "CONTENT_MANAGER")
  @Get("catalog")
  catalog() {
    return this.operations.catalog();
  }

  @Roles("SUPER_ADMIN", "CONTENT_MANAGER")
  @Post("categories")
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body()
    body: { slug?: string; nameAr?: string; nameEn?: string; parentId?: string; sortOrder?: number }
  ) {
    return this.operations.createCategory(user, body);
  }

  @Roles("SUPER_ADMIN", "CONTENT_MANAGER")
  @Patch("categories/:id")
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { nameAr?: string; nameEn?: string; sortOrder?: number; active?: boolean }
  ) {
    return this.operations.updateCategory(user, id, body);
  }

  @Roles("SUPER_ADMIN", "CONTENT_MANAGER")
  @Patch("cities/:id")
  updateCity(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { nameAr?: string; nameEn?: string; active?: boolean }
  ) {
    return this.operations.updateCity(user, id, body);
  }

  @Roles("SUPER_ADMIN", "CAMPAIGN_MANAGER", "FINANCE_MANAGER")
  @Get("analytics")
  analytics() {
    return this.operations.analytics();
  }

  @Roles("SUPER_ADMIN", "SUPPORT", "CONTENT_MANAGER")
  @Post("notifications")
  sendNotification(
    @CurrentUser() user: AuthUser,
    @Body()
    body: { userId?: string; titleAr?: string; titleEn?: string; bodyAr?: string; bodyEn?: string }
  ) {
    return this.operations.sendNotification(user, body);
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
