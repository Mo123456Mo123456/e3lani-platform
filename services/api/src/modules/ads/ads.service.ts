import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MEDIA_LIMITS } from '@e3lani/config';
import { createAdDraftSchema } from '@e3lani/validation';
import { MediaKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';
import { decorateAdMedia } from '../../common/media-urls';

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
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
}
