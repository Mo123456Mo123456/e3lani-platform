import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { REPORT_REASONS } from '@e3lani/config';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * البلاغات — المراجعة البشرية تحدث فقط بعد النشر وعند وجود بلاغ.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  reasons() {
    return REPORT_REASONS.map((reason) => ({ key: reason.key, ar: reason.ar, en: reason.en }));
  }

  async create(
    reporterId: string | null,
    input: { adId?: string; postId?: string; reason: string; note?: string },
  ) {
    if (input.adId) {
      const ad = await this.prisma.ad.findUnique({ where: { id: input.adId }, select: { id: true, userId: true } });
      if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
      if (reporterId && ad.userId === reporterId) {
        throw new BadRequestException({ message: 'لا يمكنك الإبلاغ عن إعلانك', code: 'SELF_REPORT' });
      }
    }
    if (input.postId) {
      const post = await this.prisma.post.findUnique({ where: { id: input.postId }, select: { id: true, userId: true } });
      if (!post) throw new NotFoundException({ message: 'المنشور غير موجود', code: 'POST_NOT_FOUND' });
      if (reporterId && post.userId === reporterId) {
        throw new BadRequestException({ message: 'لا يمكنك الإبلاغ عن منشورك', code: 'SELF_REPORT' });
      }
    }

    if (reporterId) {
      const duplicate = await this.prisma.report.findFirst({
        where: {
          reporterId,
          adId: input.adId ?? undefined,
          postId: input.postId ?? undefined,
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({ message: 'سبق أن أرسلت بلاغًا عن هذا المحتوى', code: 'REPORT_DUPLICATE' });
      }
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        adId: input.adId ?? null,
        postId: input.postId ?? null,
        reason: input.reason,
        note: input.note ?? null,
      },
    });

    if (input.adId) {
      await this.prisma.ad.update({
        where: { id: input.adId },
        data: { reportsCount: { increment: 1 } },
      });
    }

    await this.audit.record({
      action: 'report.created',
      entityType: input.adId ? 'Ad' : 'Post',
      entityId: input.adId ?? input.postId ?? null,
      actorUserId: reporterId,
      reason: input.reason,
    });

    return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
  }

  async listForAdmin(options: { status?: string; limit: number; cursor?: string }) {
    const rows = await this.prisma.report.findMany({
      where: options.status ? { status: options.status as any } : {},
      include: {
        ad: { select: { id: true, title: true, status: true, userId: true } },
        post: { select: { id: true, caption: true, isActive: true, userId: true } },
        reporter: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    });
    return {
      items: rows,
      nextCursor: rows.length === options.limit ? rows[rows.length - 1]!.id : null,
      hasMore: rows.length === options.limit,
    };
  }

  /** إجراء الإدارة على بلاغ: تجاهل / إيقاف / حذف / إعادة تفعيل. */
  async resolve(
    adminId: string,
    reportId: string,
    input: { action: 'DISMISS' | 'SUSPEND' | 'DELETE' | 'RESTORE'; reason: string; notifyOwner: boolean },
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { ad: true, post: true },
    });
    if (!report) throw new NotFoundException({ message: 'البلاغ غير موجود', code: 'REPORT_NOT_FOUND' });

    const ownerId = report.ad?.userId ?? report.post?.userId ?? null;
    const targetType = report.adId ? 'Ad' : 'Post';
    const targetId = report.adId ?? report.postId!;

    switch (input.action) {
      case 'SUSPEND':
        if (report.adId) {
          await this.prisma.ad.update({
            where: { id: report.adId },
            data: { status: 'PAUSED', suspendedAt: new Date(), moderationNote: input.reason },
          });
        } else if (report.postId) {
          await this.prisma.post.update({
            where: { id: report.postId },
            data: { isActive: false, removedAt: new Date(), removalReason: input.reason },
          });
        }
        break;
      case 'DELETE':
        if (report.adId) {
          await this.prisma.ad.update({
            where: { id: report.adId },
            data: { status: 'REMOVED', moderationNote: input.reason, suspendedAt: new Date() },
          });
        } else if (report.postId) {
          await this.prisma.post.update({
            where: { id: report.postId },
            data: { isActive: false, removedAt: new Date(), removalReason: input.reason },
          });
        }
        break;
      case 'RESTORE':
        if (report.adId) {
          await this.prisma.ad.update({
            where: { id: report.adId },
            data: { status: 'ACTIVE', suspendedAt: null, moderationNote: null },
          });
        } else if (report.postId) {
          await this.prisma.post.update({
            where: { id: report.postId },
            data: { isActive: true, removedAt: null, removalReason: null },
          });
        }
        break;
      default:
        break;
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: input.action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED',
        resolution: `${input.action}: ${input.reason}`,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });

    await this.audit.record({
      action: `report.${input.action.toLowerCase()}`,
      entityType: targetType,
      entityId: targetId,
      actorAdminId: adminId,
      reason: input.reason,
    });

    if (input.notifyOwner && ownerId && input.action !== 'DISMISS') {
      const isRestore = input.action === 'RESTORE';
      await this.notifications.notify(
        ownerId,
        isRestore ? 'AD_RESTORED' : targetType === 'Ad' ? 'AD_SUSPENDED' : 'POST_REMOVED',
        {
          titleAr: isRestore ? 'تمت إعادة تفعيل المحتوى' : 'تم إيقاف المحتوى',
          titleEn: isRestore ? 'Content restored' : 'Content suspended',
          bodyAr: input.reason,
          bodyEn: input.reason,
          data: { targetType, targetId, canAppeal: !isRestore },
        },
      );
    }

    return updated;
  }
}
