import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdStateService } from '../../common/ad-state.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adState: AdStateService,
  ) {}

  listPendingReview() {
    return this.prisma.ad.findMany({
      where: { status: 'PENDING_REVIEW', deletedAt: null },
      include: {
        currentRevision: { include: { category: true, city: true } },
        owner: { select: { id: true, phone: true, displayName: true } },
        media: { include: { asset: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
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
