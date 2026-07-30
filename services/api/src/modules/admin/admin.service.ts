import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AD_POLICY } from '@e3lani/config';
import {
  DEFAULT_LAUNCH_MODE,
  DEFAULT_SA_PRICING,
  isLaunchMode,
  paymentsRequired,
  type LaunchMode,
  type PricingSku,
} from '@e3lani/types';
import { CampaignStatus, Prisma, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';
import { decorateAdMedia } from '../../common/media-urls';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
  ) {}

  async getLaunchMode(): Promise<LaunchMode> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'launch_mode' } });
    const value = setting?.value;
    if (typeof value === 'string' && isLaunchMode(value)) return value;
    if (value && typeof value === 'object' && 'mode' in value && isLaunchMode((value as { mode: unknown }).mode)) {
      return (value as { mode: LaunchMode }).mode;
    }
    return (AD_POLICY.defaultLaunchMode as LaunchMode) ?? DEFAULT_LAUNCH_MODE;
  }

  async listPendingReview() {
    const rows = await this.prisma.ad.findMany({
      where: { status: 'PENDING_REVIEW', deletedAt: null },
      include: {
        currentRevision: { include: { category: true, city: true } },
        owner: { select: { id: true, phone: true, displayName: true } },
        media: { include: { asset: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
    return Promise.all(
      rows.map(async (ad) => ({ ...ad, media: await decorateAdMedia(ad.media) })),
    );
  }

  async approve(adId: string, actorId: string, notes?: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('AD_NOT_FOUND');
    if (ad.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('AD_NOT_PENDING_REVIEW');
    }
    if (!ad.currentRevisionId) throw new BadRequestException('REVISION_REQUIRED');

    await this.prisma.adRevision.update({
      where: { id: ad.currentRevisionId },
      data: { moderationStatus: 'APPROVED', moderationNotes: notes },
    });
    await this.prisma.moderationReview.create({
      data: {
        revisionId: ad.currentRevisionId,
        reviewerId: actorId,
        status: 'APPROVED',
        notes,
      },
    });
    await this.prisma.ad.update({
      where: { id: adId },
      data: {
        approvedRevisionId: ad.currentRevisionId,
        activeRevisionId: ad.currentRevisionId,
      },
    });

    const launchMode = await this.getLaunchMode();
    if (paymentsRequired(launchMode)) {
      return this.adState.transition({
        adId,
        to: 'APPROVED_AWAITING_PAYMENT',
        actorId,
        reason: notes ?? 'Approved — awaiting payment',
      });
    }

    const now = new Date();
    await this.prisma.ad.update({
      where: { id: adId },
      data: {
        publishedAt: ad.publishedAt ?? now,
        expiresAt:
          ad.expiresAt ??
          new Date(now.getTime() + AD_POLICY.defaultDurationDays * 24 * 60 * 60 * 1000),
      },
    });

    return this.adState.transition({
      adId,
      to: 'ACTIVE',
      actorId,
      reason: notes ?? 'Reactivated after review (FREE_LAUNCH)',
    });
  }

  async needsChanges(adId: string, actorId: string, notes: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('AD_NOT_FOUND');
    if (ad.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('AD_NOT_PENDING_REVIEW');
    }
    if (!ad.currentRevisionId) throw new BadRequestException('REVISION_REQUIRED');

    await this.prisma.adRevision.update({
      where: { id: ad.currentRevisionId },
      data: { moderationStatus: 'NEEDS_CHANGES', moderationNotes: notes },
    });
    await this.prisma.moderationReview.create({
      data: {
        revisionId: ad.currentRevisionId,
        reviewerId: actorId,
        status: 'NEEDS_CHANGES',
        notes,
      },
    });

    return this.adState.transition({
      adId,
      to: 'NEEDS_CHANGES',
      actorId,
      reason: notes,
    });
  }

  listOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
        attempts: true,
        transactions: true,
        user: { select: { id: true, phone: true, displayName: true } },
        ad: {
          select: {
            id: true,
            status: true,
            currentRevision: { select: { title: true } },
          },
        },
      },
    });
  }

  listPayments() {
    return this.prisma.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: {
          include: {
            user: { select: { id: true, phone: true, displayName: true } },
            ad: { select: { id: true, status: true } },
          },
        },
      },
    });
  }

  listUsers() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        phone: true,
        email: true,
        displayName: true,
        roles: true,
        isSuspended: true,
        createdAt: true,
        city: { select: { id: true, nameAr: true, nameEn: true } },
        verification: true,
        brandProfile: { select: { slug: true, nameAr: true, isVerified: true } },
      },
    });
  }

  listVerificationQueue() {
    return this.prisma.userVerification.findMany({
      where: { status: 'PENDING' },
      orderBy: { updatedAt: 'asc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            email: true,
            displayName: true,
            roles: true,
            brandProfile: { select: { slug: true, nameAr: true } },
          },
        },
      },
    });
  }

  async decideVerification(
    id: string,
    actorId: string,
    input: { status: VerificationStatus; notes?: string },
  ) {
    const before = await this.prisma.userVerification.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('VERIFICATION_NOT_FOUND');

    const updated = await this.prisma.userVerification.update({
      where: { id },
      data: {
        status: input.status,
        notes: input.notes,
        reviewedAt: input.status === 'PENDING' ? before.reviewedAt : new Date(),
      },
      include: {
        user: { select: { id: true, phone: true, displayName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'verification.decide',
        entityType: 'user_verification',
        entityId: id,
        before: { status: before.status, notes: before.notes },
        after: { status: updated.status, notes: updated.notes },
      },
    });

    return updated;
  }

  listCategoriesAdmin() {
    return this.prisma.category.findMany({
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: {
        parent: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
        children: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  createCategory(input: {
    slug?: string;
    nameAr?: string;
    nameEn?: string;
    iconKey?: string;
    sortOrder?: number;
    isActive?: boolean;
    countryCode?: string;
    parentId?: string | null;
  }) {
    if (!input.slug?.trim() || !input.nameAr?.trim() || !input.nameEn?.trim()) {
      throw new BadRequestException('CATEGORY_REQUIRED_FIELDS');
    }

    return this.prisma.category.create({
      data: {
        slug: input.slug.trim(),
        nameAr: input.nameAr.trim(),
        nameEn: input.nameEn.trim(),
        iconKey: input.iconKey?.trim() || undefined,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        countryCode: input.countryCode ?? 'SA',
        parentId: input.parentId ?? undefined,
      },
    });
  }

  updateCategory(
    id: string,
    input: {
      slug?: string;
      nameAr?: string;
      nameEn?: string;
      iconKey?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      countryCode?: string | null;
      parentId?: string | null;
    },
  ) {
    return this.prisma.category.update({
      where: { id },
      data: {
        slug: input.slug?.trim(),
        nameAr: input.nameAr?.trim(),
        nameEn: input.nameEn?.trim(),
        iconKey: input.iconKey === null ? null : input.iconKey?.trim(),
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        countryCode: input.countryCode,
        parentId: input.parentId,
      },
    });
  }

  async toggleCategory(id: string, actorId: string) {
    const before = await this.prisma.category.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('CATEGORY_NOT_FOUND');

    const updated = await this.prisma.category.update({
      where: { id },
      data: { isActive: !before.isActive },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'categories.toggle_active',
        entityType: 'category',
        entityId: id,
        before: { isActive: before.isActive },
        after: { isActive: updated.isActive },
      },
    });

    return updated;
  }

  listPricing() {
    return this.prisma.pricingVersion.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      include: {
        items: { orderBy: [{ countryCode: 'asc' }, { sku: 'asc' }] },
      },
    });
  }

  /**
   * Create a new active pricing version with updated amounts.
   * Never hardcode prices in clients — always read from admin-managed versions.
   */
  async updatePricing(
    actorId: string,
    input: { items: Array<{ sku: string; amount: number; labelAr?: string; labelEn?: string; durationDays?: number | null }> },
  ) {
    if (!input.items?.length) throw new BadRequestException('PRICING_ITEMS_REQUIRED');

    const code = `sa-admin-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
    const version = await this.prisma.$transaction(async (tx) => {
      await tx.pricingVersion.updateMany({ data: { isActive: false }, where: { isActive: true } });
      const created = await tx.pricingVersion.create({
        data: {
          code,
          isActive: true,
          items: {
            create: input.items.map((item) => {
              const defaults = DEFAULT_SA_PRICING[item.sku as PricingSku];
              if (!defaults) throw new BadRequestException(`UNKNOWN_SKU:${item.sku}`);
              return {
                sku: item.sku,
                countryCode: 'SA',
                currency: 'SAR',
                amount: item.amount,
                durationDays: item.durationDays ?? defaults.durationDays ?? null,
                labelAr: item.labelAr ?? defaults.labelAr,
                labelEn: item.labelEn ?? defaults.labelEn,
              };
            }),
          },
        },
        include: { items: true },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'pricing.update',
          entityType: 'pricing_version',
          entityId: created.id,
          after: { code, itemCount: input.items.length },
        },
      });
      return created;
    });
    return version;
  }

  async setLaunchMode(actorId: string, mode: LaunchMode) {
    if (!isLaunchMode(mode)) throw new BadRequestException('INVALID_LAUNCH_MODE');
    const setting = await this.prisma.systemSetting.upsert({
      where: { key: 'launch_mode' },
      create: { key: 'launch_mode', value: mode },
      update: { value: mode },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'launch_mode.update',
        entityType: 'system_setting',
        entityId: 'launch_mode',
        after: { mode },
      },
    });
    return setting;
  }

  listRefundOrders() {
    return this.prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        items: true,
        transactions: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, phone: true, displayName: true } },
        ad: { select: { id: true, status: true, currentRevision: { select: { title: true } } } },
      },
    });
  }

  listCampaignsAdmin() {
    return this.prisma.campaign.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        owner: { select: { id: true, phone: true, displayName: true } },
        ads: {
          include: {
            ad: { select: { id: true, status: true, currentRevision: { select: { title: true } } } },
          },
        },
      },
    });
  }

  async updateCampaignStatus(id: string, actorId: string, status: CampaignStatus) {
    const before = await this.prisma.campaign.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('CAMPAIGN_NOT_FOUND');

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status },
      include: {
        owner: { select: { id: true, phone: true, displayName: true } },
        ads: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'campaigns.admin_status_update',
        entityType: 'campaign',
        entityId: id,
        before: { status: before.status },
        after: { status: updated.status },
      },
    });

    return updated;
  }

  async getSetting(key: string, fallback: Prisma.InputJsonValue) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    return setting ?? { key, value: fallback, updatedAt: null };
  }

  async updateSetting(key: string, value: Prisma.InputJsonValue) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  listAudit() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { id: true, phone: true, displayName: true, roles: true } },
      },
    });
  }

  async reject(adId: string, actorId: string, notes: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('AD_NOT_FOUND');
    if (ad.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('AD_NOT_PENDING_REVIEW');
    }
    if (ad.currentRevisionId) {
      await this.prisma.adRevision.update({
        where: { id: ad.currentRevisionId },
        data: { moderationStatus: 'REJECTED', moderationNotes: notes },
      });
    }
    return this.adState.transition({
      adId,
      to: 'REJECTED',
      actorId,
      reason: notes,
    });
  }
}
