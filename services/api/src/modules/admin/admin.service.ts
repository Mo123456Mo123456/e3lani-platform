import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';
import { decorateAdMedia } from '../../common/media-urls';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
  ) {}

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
      data: { approvedRevisionId: ad.currentRevisionId },
    });

    return this.adState.transition({
      adId,
      to: 'APPROVED_AWAITING_PAYMENT',
      actorId,
      reason: notes ?? 'Approved — awaiting payment',
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
