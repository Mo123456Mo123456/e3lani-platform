import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

/** الاعتراضات على قرارات الإيقاف أو الحذف. */
@Injectable()
export class AppealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, input: { adId?: string; postId?: string; message: string }) {
    if (!input.adId && !input.postId) {
      throw new BadRequestException({ message: 'حدّد الإعلان أو المنشور', code: 'TARGET_REQUIRED' });
    }

    if (input.adId) {
      const ad = await this.prisma.ad.findFirst({
        where: { id: input.adId, userId },
        select: { id: true, status: true },
      });
      if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
      if (!['PAUSED', 'REMOVED', 'REJECTED'].includes(ad.status)) {
        throw new BadRequestException({ message: 'لا يوجد قرار للاعتراض عليه', code: 'NO_DECISION' });
      }
    }

    if (input.postId) {
      const post = await this.prisma.post.findFirst({
        where: { id: input.postId, userId },
        select: { id: true, isActive: true },
      });
      if (!post) throw new NotFoundException({ message: 'المنشور غير موجود', code: 'POST_NOT_FOUND' });
      if (post.isActive) {
        throw new BadRequestException({ message: 'لا يوجد قرار للاعتراض عليه', code: 'NO_DECISION' });
      }
    }

    const relatedReport = await this.prisma.report.findFirst({
      where: { adId: input.adId ?? undefined, postId: input.postId ?? undefined, status: 'ACTIONED' },
      orderBy: { resolvedAt: 'desc' },
      select: { id: true },
    });

    const appeal = await this.prisma.appeal.create({
      data: {
        userId,
        adId: input.adId ?? null,
        postId: input.postId ?? null,
        reportId: relatedReport?.id ?? null,
        message: input.message,
      },
    });

    await this.audit.record({
      action: 'appeal.created',
      entityType: input.adId ? 'Ad' : 'Post',
      entityId: input.adId ?? input.postId ?? null,
      actorUserId: userId,
    });

    return { id: appeal.id, status: appeal.status, createdAt: appeal.createdAt.toISOString() };
  }

  async listMine(userId: string) {
    return this.prisma.appeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listForAdmin(status?: string, limit = 50) {
    return this.prisma.appeal.findMany({
      where: status ? { status: status as any } : {},
      include: {
        user: { select: { id: true, name: true, phone: true } },
        ad: { select: { id: true, title: true, status: true } },
        post: { select: { id: true, caption: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async decide(
    adminId: string,
    appealId: string,
    input: { decision: 'ACCEPT' | 'REJECT'; note: string },
  ) {
    const appeal = await this.prisma.appeal.findUnique({ where: { id: appealId } });
    if (!appeal) throw new NotFoundException({ message: 'الاعتراض غير موجود', code: 'APPEAL_NOT_FOUND' });

    if (input.decision === 'ACCEPT') {
      if (appeal.adId) {
        await this.prisma.ad.update({
          where: { id: appeal.adId },
          data: { status: 'ACTIVE', suspendedAt: null, moderationNote: null },
        });
      }
      if (appeal.postId) {
        await this.prisma.post.update({
          where: { id: appeal.postId },
          data: { isActive: true, removedAt: null, removalReason: null },
        });
      }
    }

    const updated = await this.prisma.appeal.update({
      where: { id: appealId },
      data: {
        status: input.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
        decisionNote: input.note,
        decidedById: adminId,
        decidedAt: new Date(),
      },
    });

    await this.audit.record({
      action: `appeal.${input.decision.toLowerCase()}`,
      entityType: 'Appeal',
      entityId: appealId,
      actorAdminId: adminId,
      reason: input.note,
    });

    await this.notifications.notify(appeal.userId, 'APPEAL_RESOLVED', {
      titleAr: input.decision === 'ACCEPT' ? 'تم قبول اعتراضك' : 'تم رفض اعتراضك',
      titleEn: input.decision === 'ACCEPT' ? 'Appeal accepted' : 'Appeal rejected',
      bodyAr: input.note,
      bodyEn: input.note,
      data: { appealId },
    });

    return updated;
  }
}
