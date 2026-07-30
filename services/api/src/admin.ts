import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { prisma } from "@e3lani/database";
import {
  moderationDecisionSchema,
  paginationSchema,
  priceCodes,
  updatePriceSchema,
} from "@e3lani/types";

import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  type AuthUser,
} from "./auth.js";

const adminRoles = [
  "SUPER_ADMIN",
  "ADS_MODERATOR",
  "SUPPORT",
  "CAMPAIGN_MANAGER",
  "FINANCE_MANAGER",
  "CONTENT_MANAGER",
] as const;

async function writeAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string,
  reason?: string,
) {
  await prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, reason },
  });
}

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...adminRoles)
export class AdminController {
  @Get("dashboard")
  async dashboard() {
    const [users, activeAds, openReports, openAppeals, pendingBanners, revenue] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.ad.count({ where: { status: "ACTIVE" } }),
      prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
      prisma.appeal.count({ where: { status: "OPEN" } }),
      prisma.bannerPlacement.count({ where: { status: "AWAITING_REVIEW" } }),
      prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalHalalas: true } }),
    ]);
    return {
      users,
      activeAds,
      openReports,
      openAppeals,
      pendingBanners,
      paidRevenueHalalas: revenue._sum.totalHalalas ?? 0,
    };
  }

  @Get("users")
  @Roles("SUPER_ADMIN", "SUPPORT")
  async users(@Query() raw: Record<string, string | undefined>) {
    const { page, limit } = paginationSchema.parse(raw);
    return prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { city: true, businessProfile: true },
    });
  }

  @Patch("users/:id/status")
  @Roles("SUPER_ADMIN", "SUPPORT")
  async userStatus(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() body: { status?: "ACTIVE" | "SUSPENDED"; reason?: string },
  ) {
    if (!body.status || !["ACTIVE", "SUSPENDED"].includes(body.status)) {
      throw new BadRequestException("STATUS_INVALID");
    }
    if (!body.reason?.trim()) throw new BadRequestException("REASON_REQUIRED");
    const user = await prisma.user.update({ where: { id }, data: { status: body.status } });
    await writeAudit(actor.id, `USER_${body.status}`, "User", id, body.reason);
    return user;
  }

  @Patch("users/:id/role")
  @Roles("SUPER_ADMIN")
  async userRole(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() body: { role?: (typeof adminRoles)[number] | "USER"; reason?: string },
  ) {
    const allowed = ["USER", ...adminRoles];
    if (!body.role || !allowed.includes(body.role)) throw new BadRequestException("ROLE_INVALID");
    if (!body.reason?.trim()) throw new BadRequestException("REASON_REQUIRED");
    const user = await prisma.user.update({ where: { id }, data: { staffRole: body.role } });
    await writeAudit(actor.id, "USER_ROLE_CHANGED", "User", id, body.reason);
    return user;
  }

  @Get("reports")
  @Roles("SUPER_ADMIN", "ADS_MODERATOR", "SUPPORT")
  reports() {
    return prisma.report.findMany({
      where: { status: { in: ["OPEN", "REVIEWING"] } },
      orderBy: { createdAt: "asc" },
      include: { ad: true, reporter: { select: { id: true, name: true, phone: true } } },
    });
  }

  @Patch("reports/:id")
  @Roles("SUPER_ADMIN", "ADS_MODERATOR")
  async decideReport(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const decision = moderationDecisionSchema.parse(body);
    const report = await prisma.report.findUnique({ where: { id }, include: { ad: true } });
    if (!report) throw new BadRequestException("REPORT_NOT_FOUND");
    await prisma.$transaction(async (tx) => {
      const status = decision.action === "DISMISS" ? "DISMISSED" : "RESOLVED";
      await tx.report.update({
        where: { id },
        data: {
          status,
          moderatorId: actor.id,
          resolution: decision.reason,
          resolvedAt: new Date(),
        },
      });
      const adStatus =
        decision.action === "DELETE"
          ? "DELETED"
          : decision.action === "REACTIVATE"
            ? "ACTIVE"
            : decision.action === "SUSPEND"
              ? "SUSPENDED"
              : undefined;
      if (adStatus) {
        await tx.ad.update({
          where: { id: report.adId },
          data: {
            status: adStatus,
            suspendedAt: adStatus === "SUSPENDED" ? new Date() : null,
            suspensionReason: adStatus === "SUSPENDED" ? decision.reason : null,
          },
        });
      }
      if (decision.notifyOwner) {
        await tx.notification.create({
          data: {
            userId: report.ad.ownerId,
            type: "MODERATION_DECISION",
            titleAr: "تحديث حالة إعلانك",
            titleEn: "Advertisement status updated",
            bodyAr: decision.reason,
            bodyEn: decision.reason,
            data: { adId: report.adId, action: decision.action },
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: `REPORT_${decision.action}`,
          entityType: "Report",
          entityId: id,
          reason: decision.reason,
        },
      });
    });
    return { resolved: true };
  }

  @Get("appeals")
  @Roles("SUPER_ADMIN", "ADS_MODERATOR", "SUPPORT")
  appeals() {
    return prisma.appeal.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: { ad: true, appellant: { select: { id: true, name: true, phone: true } } },
    });
  }

  @Patch("appeals/:id")
  @Roles("SUPER_ADMIN", "ADS_MODERATOR")
  async decideAppeal(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() body: { accepted?: boolean; reason?: string },
  ) {
    if (typeof body.accepted !== "boolean" || !body.reason?.trim()) {
      throw new BadRequestException("DECISION_AND_REASON_REQUIRED");
    }
    const appeal = await prisma.appeal.findUnique({ where: { id }, include: { ad: true } });
    if (!appeal) throw new BadRequestException("APPEAL_NOT_FOUND");
    await prisma.$transaction([
      prisma.appeal.update({
        where: { id },
        data: {
          status: body.accepted ? "ACCEPTED" : "REJECTED",
          reviewerId: actor.id,
          decision: body.reason,
        },
      }),
      ...(body.accepted
        ? [
            prisma.ad.update({
              where: { id: appeal.adId },
              data: { status: "ACTIVE" as const, suspendedAt: null, suspensionReason: null },
            }),
          ]
        : []),
      prisma.notification.create({
        data: {
          userId: appeal.appellantId,
          type: "APPEAL_DECISION",
          titleAr: "تمت مراجعة اعتراضك",
          titleEn: "Your appeal was reviewed",
          bodyAr: body.reason,
          bodyEn: body.reason,
          data: { appealId: id, accepted: body.accepted },
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: body.accepted ? "APPEAL_ACCEPTED" : "APPEAL_REJECTED",
          entityType: "Appeal",
          entityId: id,
          reason: body.reason,
        },
      }),
    ]);
    return { accepted: body.accepted };
  }

  @Get("prices")
  @Roles("SUPER_ADMIN", "FINANCE_MANAGER")
  prices() {
    return prisma.pricingItem.findMany({ orderBy: { createdAt: "asc" } });
  }

  @Patch("prices/:code")
  @Roles("SUPER_ADMIN", "FINANCE_MANAGER")
  async price(
    @CurrentUser() actor: AuthUser,
    @Param("code") code: string,
    @Body() body: unknown,
  ) {
    if (!priceCodes.includes(code as (typeof priceCodes)[number])) {
      throw new BadRequestException("PRICE_CODE_INVALID");
    }
    const input = updatePriceSchema.parse(body);
    const updated = await prisma.pricingItem.update({
      where: { code },
      data: { ...input, updatedById: actor.id, version: { increment: 1 } },
    });
    await writeAudit(actor.id, "PRICE_UPDATED", "PricingItem", updated.id);
    return updated;
  }

  @Post("categories")
  @Roles("SUPER_ADMIN", "CONTENT_MANAGER")
  async category(
    @CurrentUser() actor: AuthUser,
    @Body()
    body: {
      slug?: string;
      nameAr?: string;
      nameEn?: string;
      parentId?: string;
      icon?: string;
    },
  ) {
    if (!body.slug || !body.nameAr || !body.nameEn) {
      throw new BadRequestException("CATEGORY_FIELDS_REQUIRED");
    }
    const created = await prisma.category.create({
      data: {
        slug: body.slug,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        parentId: body.parentId,
        icon: body.icon,
      },
    });
    await writeAudit(actor.id, "CATEGORY_CREATED", "Category", created.id);
    return created;
  }

  @Patch("banners/:id")
  @Roles("SUPER_ADMIN", "CAMPAIGN_MANAGER")
  async banner(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() body: { action?: "APPROVE" | "REJECT" | "PAUSE"; reason?: string },
  ) {
    if (!body.action || !body.reason?.trim()) throw new BadRequestException("DECISION_REQUIRED");
    const status =
      body.action === "APPROVE" ? "APPROVED" : body.action === "REJECT" ? "REJECTED" : "PAUSED";
    const banner = await prisma.bannerPlacement.update({
      where: { id },
      data: { status, reviewNote: body.reason },
    });
    await writeAudit(actor.id, `BANNER_${body.action}`, "BannerPlacement", id, body.reason);
    return banner;
  }

  @Get("banners")
  @Roles("SUPER_ADMIN", "CAMPAIGN_MANAGER")
  banners() {
    return prisma.bannerPlacement.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        logoMedia: { select: { thumbnailUrl: true, status: true } },
      },
    });
  }

  @Get("audit")
  @Roles("SUPER_ADMIN")
  audit() {
    return prisma.auditLog.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, phone: true } } },
    });
  }
}

interface PaymentAdapter {
  createCheckout(order: { id: string; amount: number }): Promise<{ reference: string; url: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
}

class DisabledPaymentAdapter implements PaymentAdapter {
  async createCheckout(): Promise<never> {
    throw new ServiceUnavailableException("PAYMENTS_DISABLED");
  }
  verifyWebhook(): boolean {
    return false;
  }
}

class MoyasarPaymentAdapter implements PaymentAdapter {
  async createCheckout(order: { id: string; amount: number }) {
    const secret = process.env.MOYASAR_SECRET_KEY;
    if (!secret) throw new ServiceUnavailableException("MOYASAR_NOT_CONFIGURED");
    const response = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: order.amount,
        currency: "SAR",
        description: `E3lani order ${order.id}`,
        callback_url: `${process.env.WEB_ORIGIN}/payments/return`,
      }),
    });
    if (!response.ok) throw new ServiceUnavailableException("PAYMENT_PROVIDER_ERROR");
    const invoice = (await response.json()) as { id: string; url: string };
    return { reference: invoice.id, url: invoice.url };
  }

  verifyWebhook(rawBody: Buffer, signature: string) {
    const secret = process.env.MOYASAR_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

function paymentAdapter(): PaymentAdapter {
  return process.env.PAYMENTS_ENABLED === "true" && process.env.PAYMENT_PROVIDER === "moyasar"
    ? new MoyasarPaymentAdapter()
    : new DisabledPaymentAdapter();
}

@Controller("payments")
export class PaymentsController {
  @Post("checkout")
  @UseGuards(JwtAuthGuard)
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() body: { adId?: string; priceCodes?: string[]; idempotencyKey?: string },
  ) {
    if (!body.adId || !body.idempotencyKey || !body.priceCodes?.length) {
      throw new BadRequestException("CHECKOUT_FIELDS_REQUIRED");
    }
    if (process.env.PAYMENTS_ENABLED !== "true") {
      throw new ServiceUnavailableException("PAYMENTS_DISABLED");
    }
    const ad = await prisma.ad.findFirst({ where: { id: body.adId, ownerId: user.id } });
    if (!ad) throw new BadRequestException("AD_NOT_FOUND");
    const uniqueCodes = [...new Set(body.priceCodes)];
    const prices = await prisma.pricingItem.findMany({
      where: { code: { in: uniqueCodes }, enabled: true },
    });
    if (prices.length !== uniqueCodes.length) throw new BadRequestException("PRICE_ITEM_INVALID");
    const totalHalalas = prices.reduce((sum, item) => sum + item.priceHalalas, 0);
    const order = await prisma.order.upsert({
      where: { idempotencyKey: body.idempotencyKey },
      update: {},
      create: {
        id: randomUUID(),
        userId: user.id,
        adId: ad.id,
        totalHalalas,
        idempotencyKey: body.idempotencyKey,
        provider: process.env.PAYMENT_PROVIDER ?? "disabled",
        items: prices.map((item) => ({ code: item.code, priceHalalas: item.priceHalalas })),
      },
    });
    if (order.userId !== user.id || order.totalHalalas !== totalHalalas) {
      throw new BadRequestException("IDEMPOTENCY_KEY_CONFLICT");
    }
    const checkout = await paymentAdapter().createCheckout({
      id: order.id,
      amount: order.totalHalalas,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { providerRef: checkout.reference },
    });
    return { orderId: order.id, checkoutUrl: checkout.url };
  }

  @Post("webhooks/moyasar")
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-moyasar-signature") signature = "",
    @Body() body: { id?: string; status?: string },
  ) {
    const rawBody = request.rawBody;
    if (!rawBody || !paymentAdapter().verifyWebhook(rawBody, signature)) {
      throw new BadRequestException("WEBHOOK_SIGNATURE_INVALID");
    }
    if (!body.id) throw new BadRequestException("WEBHOOK_REFERENCE_MISSING");
    const order = await prisma.order.findUnique({ where: { providerRef: body.id } });
    if (!order) return { accepted: true };
    if (body.status !== "paid" || order.status === "PAID") return { accepted: true };
    const standardPrice = await prisma.pricingItem.findUnique({ where: { code: "STANDARD_AD" } });
    const durationDays = standardPrice?.durationDays ?? 30;
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date() },
      }),
      ...(order.adId
        ? [
            prisma.ad.update({
              where: { id: order.adId },
              data: {
                status: "ACTIVE" as const,
                publishedAt: new Date(),
                expiresAt: new Date(Date.now() + durationDays * 86_400_000),
              },
            }),
          ]
        : []),
      prisma.auditLog.create({
        data: {
          action: "PAYMENT_CONFIRMED",
          entityType: "Order",
          entityId: order.id,
        },
      }),
    ]);
    return { accepted: true };
  }
}
