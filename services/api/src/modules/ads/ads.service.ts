import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AD_POLICY, MEDIA_LIMITS } from '@e3lani/config';
import { createAdDraftSchema } from '@e3lani/validation';
import { AdStatus, MediaKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';
import { decorateAdMedia } from '../../common/media-urls';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
    private readonly audit: AuditService,
  ) {}

  async listMine(ownerId: string) {
    const ads = await this.prisma.ad.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        currentRevision: { include: { category: true, city: true } },
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return Promise.all(
      ads.map(async (ad) => ({ ...ad, media: await decorateAdMedia(ad.media) })),
    );
  }

  async createDraft(ownerId: string, body: unknown) {
    const input = createAdDraftSchema.parse(body);

    return this.prisma.$transaction(async (tx) => {
      const ad = await tx.ad.create({
        data: {
          ownerId,
          status: 'DRAFT',
        },
      });

      const revision = await tx.adRevision.create({
        data: {
          adId: ad.id,
          version: 1,
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          countryCode: input.countryCode,
          cityId: input.cityId,
          contactMethods: input.contactMethods,
          moderationStatus: 'NOT_SUBMITTED',
        },
      });

      return tx.ad.update({
        where: { id: ad.id },
        data: { currentRevisionId: revision.id },
        include: { currentRevision: true },
      });
    });
  }

  async getById(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: {
        currentRevision: { include: { category: true, city: true } },
        owner: { select: { id: true, displayName: true, brandProfile: true } },
        media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!ad || ad.deletedAt) throw new NotFoundException('AD_NOT_FOUND');
    return { ...ad, media: await decorateAdMedia(ad.media) };
  }

  async submitReview(adId: string, ownerId: string) {
    const ad = await this.getById(adId);
    if (ad.ownerId !== ownerId) throw new ForbiddenException();
    if (!ad.currentRevision) throw new BadRequestException('REVISION_REQUIRED');

    const images = ad.media.filter((row) => row.asset.kind === MediaKind.IMAGE);
    const videos = ad.media.filter((row) => row.asset.kind === MediaKind.VIDEO);
    if (images.length < MEDIA_LIMITS.minImages) {
      throw new BadRequestException(`At least ${MEDIA_LIMITS.minImages} image required`);
    }
    if (images.length > MEDIA_LIMITS.maxImages) {
      throw new BadRequestException(`Max ${MEDIA_LIMITS.maxImages} images per ad`);
    }
    const notReady = ad.media.filter((row) => row.asset.status !== 'READY');
    if (notReady.length > 0) {
      throw new BadRequestException('All media must be READY before review');
    }
    if (videos.some((row) => (row.asset.durationSec ?? 0) > MEDIA_LIMITS.maxVideoSeconds)) {
      throw new BadRequestException('Video exceeds 60 seconds');
    }

    return this.adState.transition({
      adId,
      to: 'PENDING_REVIEW',
      actorId: ownerId,
      reason: 'Submitted for review',
    });
  }

  async approve(adId: string, actorId: string, notes?: string) {
    const ad = await this.getById(adId);
    if (!ad.currentRevisionId) throw new BadRequestException('REVISION_REQUIRED');

    await this.prisma.adRevision.update({
      where: { id: ad.currentRevisionId },
      data: {
        moderationStatus: 'APPROVED',
        moderationNotes: notes,
      },
    });

    await this.prisma.ad.update({
      where: { id: adId },
      data: { approvedRevisionId: ad.currentRevisionId },
    });

    return this.adState.transition({
      adId,
      to: 'APPROVED_AWAITING_PAYMENT',
      actorId,
      reason: notes ?? 'Approved — awaiting payment',
    });
  }

  /** Content edits after approval invalidate payment eligibility. */
  async createRevision(adId: string, ownerId: string, body: unknown) {
    const input = createAdDraftSchema.parse(body);
    const ad = await this.getById(adId);
    if (ad.ownerId !== ownerId) throw new ForbiddenException();

    const latest = await this.prisma.adRevision.findFirst({
      where: { adId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const revision = await this.prisma.adRevision.create({
      data: {
        adId,
        version,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        countryCode: input.countryCode,
        cityId: input.cityId,
        contactMethods: input.contactMethods,
        moderationStatus: 'NOT_SUBMITTED',
      },
    });

    const updated = await this.prisma.ad.update({
      where: { id: adId },
      data: {
        currentRevisionId: revision.id,
        approvedRevisionId: null,
        status: 'DRAFT',
      },
      include: { currentRevision: true },
    });

    await this.prisma.adStatusHistory.create({
      data: {
        adId,
        fromStatus: ad.status,
        toStatus: 'DRAFT',
        reason: 'Content edited — payment eligibility revoked; resubmit for review',
        actorId: ownerId,
      },
    });

    return updated;
  }

  async pause(adId: string, ownerId: string) {
    const ad = await this.getOwnedAd(adId, ownerId);
    if (ad.status !== 'ACTIVE') throw new BadRequestException('AD_NOT_ACTIVE');

    const updated = await this.adState.transition({
      adId,
      to: 'PAUSED',
      actorId: ownerId,
      reason: 'Paused by owner',
    });
    await this.auditAdChange(ownerId, 'ads.pause', adId, ad.status, updated.status);
    await this.notifyAdOwner(ownerId, 'ad.paused', adId, 'Ad paused', 'Your ad was paused');
    return updated;
  }

  async resume(adId: string, ownerId: string) {
    const ad = await this.getOwnedAd(adId, ownerId);
    if (ad.status !== 'PAUSED') throw new BadRequestException('AD_NOT_PAUSED');
    if (ad.expiresAt && ad.expiresAt <= new Date()) {
      throw new BadRequestException('AD_EXPIRED');
    }

    const updated = await this.adState.transition({
      adId,
      to: 'ACTIVE',
      actorId: ownerId,
      reason: 'Resumed by owner',
    });
    await this.auditAdChange(ownerId, 'ads.resume', adId, ad.status, updated.status);
    await this.notifyAdOwner(ownerId, 'ad.resumed', adId, 'Ad resumed', 'Your ad is active again');
    return updated;
  }

  async schedule(adId: string, ownerId: string, scheduledAt: Date) {
    if (scheduledAt <= new Date()) throw new BadRequestException('SCHEDULED_AT_MUST_BE_FUTURE');
    const ad = await this.getOwnedAd(adId, ownerId);
    if (!['APPROVED_AWAITING_PAYMENT', 'APPROVED', 'ACTIVE'].includes(ad.status)) {
      throw new BadRequestException('AD_NOT_SCHEDULABLE');
    }

    if (ad.status === 'APPROVED_AWAITING_PAYMENT') {
      const updated = await this.prisma.ad.update({
        where: { id: adId },
        data: { scheduledAt },
      });
      await this.auditAdChange(ownerId, 'ads.schedule', adId, ad.status, updated.status, {
        scheduledAt: scheduledAt.toISOString(),
      });
      return updated;
    }

    await this.prisma.ad.update({
      where: { id: adId },
      data: { scheduledAt },
    });
    const updated = await this.adState.transition({
      adId,
      to: 'SCHEDULED',
      actorId: ownerId,
      reason: `Scheduled for ${scheduledAt.toISOString()}`,
    });
    await this.auditAdChange(ownerId, 'ads.schedule', adId, ad.status, updated.status, {
      scheduledAt: scheduledAt.toISOString(),
    });
    return updated;
  }

  async expireDueAds() {
    const now = new Date();
    const due = await this.prisma.ad.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAUSED'] },
        expiresAt: { lt: now },
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const ad of due) {
      await this.adState.transition({
        adId: ad.id,
        to: 'EXPIRED',
        reason: 'Expired by lifecycle job',
      });
    }

    return { ok: true, count: due.length };
  }

  async activateScheduled() {
    const now = new Date();
    const scheduled = await this.prisma.ad.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
        deletedAt: null,
      },
      select: {
        id: true,
        currentRevisionId: true,
        approvedRevisionId: true,
        activeRevisionId: true,
        publishedAt: true,
        expiresAt: true,
      },
    });

    for (const ad of scheduled) {
      const publishedAt = ad.publishedAt ?? now;
      await this.prisma.ad.update({
        where: { id: ad.id },
        data: {
          activeRevisionId: ad.activeRevisionId ?? ad.approvedRevisionId ?? ad.currentRevisionId,
          publishedAt,
          expiresAt:
            ad.expiresAt ??
            new Date(publishedAt.getTime() + AD_POLICY.defaultDurationDays * 24 * 60 * 60 * 1000),
        },
      });
      await this.adState.transition({
        adId: ad.id,
        to: 'ACTIVE',
        reason: 'Activated by lifecycle job',
      });
    }

    return { ok: true, count: scheduled.length };
  }

  async republish(adId: string, ownerId: string) {
    const ad = await this.getOwnedAd(adId, ownerId);
    if (ad.status !== 'EXPIRED') throw new BadRequestException('AD_NOT_EXPIRED');
    const target: AdStatus =
      ad.approvedRevisionId && ad.approvedRevisionId === ad.currentRevisionId
        ? 'APPROVED_AWAITING_PAYMENT'
        : 'DRAFT';

    await this.prisma.ad.update({
      where: { id: adId },
      data: { scheduledAt: null, publishedAt: null, expiresAt: null },
    });
    const updated = await this.adState.transition({
      adId,
      to: target,
      actorId: ownerId,
      reason:
        target === 'APPROVED_AWAITING_PAYMENT'
          ? 'Republished expired approved ad; payment required'
          : 'Republished expired ad as draft; review required',
    });
    await this.auditAdChange(ownerId, 'ads.republish', adId, ad.status, updated.status);
    await this.notifyAdOwner(
      ownerId,
      'ad.republished',
      adId,
      'Ad republished',
      'Your expired ad is ready for the next step',
    );
    return updated;
  }

  async extend(adId: string, ownerId: string) {
    const ad = await this.getOwnedAd(adId, ownerId);
    if (!['ACTIVE', 'PAUSED'].includes(ad.status)) throw new BadRequestException('AD_NOT_EXTENDABLE');

    const base = ad.expiresAt && ad.expiresAt > new Date() ? ad.expiresAt : new Date();
    const expiresAt = new Date(base.getTime() + AD_POLICY.extendDays * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.ad.update({
      where: { id: adId },
      data: { expiresAt },
    });
    await this.audit.write({
      actorId: ownerId,
      action: 'ads.extend',
      entityType: 'ad',
      entityId: adId,
      before: { status: ad.status, expiresAt: ad.expiresAt?.toISOString() ?? null },
      after: { status: updated.status, expiresAt: expiresAt.toISOString() },
      reason: 'Sandbox/staging direct extension; production should attach a paid order',
    });
    return updated;
  }

  async share(adId: string, userId?: string, channel?: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.deletedAt) throw new NotFoundException('AD_NOT_FOUND');

    await this.prisma.analyticsEvent.create({
      data: {
        name: 'ad.share',
        adId,
        userId,
        platform: channel,
      },
    });

    const baseUrl = (process.env.PUBLIC_WEB_URL ?? process.env.APP_URL ?? 'https://e3lani.com').replace(
      /\/$/,
      '',
    );
    return { ok: true, shareUrl: `${baseUrl}/ads/${adId}` };
  }

  private async getOwnedAd(adId: string, ownerId: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.deletedAt) throw new NotFoundException('AD_NOT_FOUND');
    if (ad.ownerId !== ownerId) throw new ForbiddenException();
    return ad;
  }

  private auditAdChange(
    actorId: string,
    action: string,
    adId: string,
    beforeStatus: AdStatus,
    afterStatus: AdStatus,
    afterExtra?: Record<string, string>,
  ) {
    return this.audit.write({
      actorId,
      action,
      entityType: 'ad',
      entityId: adId,
      before: { status: beforeStatus },
      after: { status: afterStatus, ...(afterExtra ?? {}) },
    });
  }

  private notifyAdOwner(
    userId: string,
    type: string,
    adId: string,
    titleEn: string,
    bodyEn: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        titleAr: titleEn,
        titleEn,
        bodyAr: bodyEn,
        bodyEn,
        payload: { adId },
      },
    });
  }
}
