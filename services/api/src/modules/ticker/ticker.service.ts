import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PRICING_KEYS } from '@e3lani/config';
import type { TickerLogoDto, TickerRequestDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';

const DAY_MS = 86_400_000;

/**
 * الشريط الإعلاني العلوي — شعارات فقط.
 * لا يحمل أي رابط، وغير قابل للنقر: كائن العرض لا يتضمن حقل رابط إطلاقًا.
 */
@Injectable()
export class TickerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly pricing: PricingService,
  ) {}

  /** الشعارات النشطة لعرضها في الشريط — بدون أي روابط. */
  async activeLogos(): Promise<{ enabled: boolean; logos: TickerLogoDto[] }> {
    if (!(await this.settings.tickerEnabled())) return { enabled: false, logos: [] };

    const now = new Date();
    const rows = await this.prisma.tickerRequest.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      include: { logoMedia: true },
      orderBy: [{ sortWeight: 'asc' }, { createdAt: 'asc' }],
      take: 60,
    });

    const logos: TickerLogoDto[] = rows
      .map((row) => ({
        id: row.id,
        businessName: row.businessName,
        logoUrl:
          this.storage.publicUrlFor(row.logoMedia.playbackKey ?? row.logoMedia.originalKey) ?? '',
        sortWeight: row.sortWeight,
      }))
      .filter((logo) => logo.logoUrl.length > 0);

    return { enabled: true, logos: dedupeAdjacent(logos) };
  }

  private toDto(row: any): TickerRequestDto {
    return {
      id: row.id,
      businessName: row.businessName,
      status: row.status,
      logoUrl: row.logoMedia
        ? this.storage.publicUrlFor(row.logoMedia.playbackKey ?? row.logoMedia.originalKey)
        : null,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      reviewNote: row.reviewNote ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createRequest(
    userId: string,
    input: { businessName: string; logoMediaId: string; requestedDays: number; note?: string },
  ): Promise<TickerRequestDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { accountType: true, profileCompleted: true },
    });
    if (!user.profileCompleted) {
      throw new ForbiddenException({ message: 'أكمل بيانات حسابك أولًا', code: 'PROFILE_INCOMPLETE' });
    }
    if (user.accountType === 'INDIVIDUAL') {
      throw new ForbiddenException({
        message: 'شريط الشعارات متاح للحسابات التجارية فقط',
        code: 'BUSINESS_ONLY',
      });
    }

    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: input.logoMediaId, ownerId: userId, purpose: 'TICKER_LOGO' },
      select: { id: true, status: true },
    });
    if (!media) throw new NotFoundException({ message: 'الشعار غير موجود', code: 'MEDIA_NOT_FOUND' });
    if (media.status === 'FAILED') {
      throw new BadRequestException({ message: 'فشل فحص ملف الشعار', code: 'MEDIA_FAILED' });
    }

    const paymentsEnabled = await this.settings.paymentsEnabled();
    const request = await this.prisma.tickerRequest.create({
      data: {
        userId,
        businessName: input.businessName,
        logoMediaId: input.logoMediaId,
        requestedDays: input.requestedDays,
        note: input.note ?? null,
        // شعارات الشريط تُراجَع بشريًا دائمًا (استثناء معتمد عن قاعدة النشر المباشر)
        status: paymentsEnabled ? 'PENDING_PAYMENT' : 'PENDING_REVIEW',
      },
      include: { logoMedia: true },
    });

    await this.audit.record({
      action: 'ticker.requested',
      entityType: 'TickerRequest',
      entityId: request.id,
      actorUserId: userId,
    });

    return this.toDto(request);
  }

  async listMine(userId: string): Promise<TickerRequestDto[]> {
    const rows = await this.prisma.tickerRequest.findMany({
      where: { userId },
      include: { logoMedia: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async cancel(userId: string, requestId: string): Promise<TickerRequestDto> {
    const request = await this.prisma.tickerRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) throw new NotFoundException({ message: 'الطلب غير موجود', code: 'TICKER_NOT_FOUND' });
    if (['ACTIVE', 'APPROVED'].includes(request.status)) {
      throw new ConflictException({
        message: 'لا يمكن إلغاء طلب معتمد، تواصل مع الدعم',
        code: 'TICKER_LOCKED',
      });
    }
    const updated = await this.prisma.tickerRequest.update({
      where: { id: requestId },
      data: { status: 'STOPPED' },
      include: { logoMedia: true },
    });
    return this.toDto(updated);
  }

  /* --------------------------- الإدارة -------------------------------- */

  async listForAdmin(status?: string, limit = 50) {
    const rows = await this.prisma.tickerRequest.findMany({
      where: status ? { status: status as any } : {},
      include: { logoMedia: true, user: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      ...this.toDto(row),
      owner: row.user,
      requestedDays: row.requestedDays,
      note: row.note,
    }));
  }

  async review(
    adminId: string,
    requestId: string,
    input: { decision: 'APPROVE' | 'REJECT' | 'STOP'; reason?: string; startsAt?: Date; days?: number },
  ): Promise<TickerRequestDto> {
    const request = await this.prisma.tickerRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException({ message: 'الطلب غير موجود', code: 'TICKER_NOT_FOUND' });

    if (input.decision === 'APPROVE') {
      const pricingItem = await this.pricing
        .require(PRICING_KEYS.TICKER_LOGO)
        .catch(() => null);
      const days = input.days ?? request.requestedDays ?? pricingItem?.durationDays ?? 30;
      const startsAt = input.startsAt ?? new Date();
      const endsAt = new Date(startsAt.getTime() + days * DAY_MS);

      const updated = await this.prisma.tickerRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACTIVE',
          startsAt,
          endsAt,
          reviewNote: input.reason ?? null,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
        include: { logoMedia: true },
      });

      await this.audit.record({
        action: 'ticker.approved',
        entityType: 'TickerRequest',
        entityId: requestId,
        actorAdminId: adminId,
        after: { startsAt, endsAt },
      });

      await this.notifications.notify(request.userId, 'TICKER_ACTIVE', {
        titleAr: 'تم اعتماد شعارك في الشريط العلوي',
        titleEn: 'Your ticker logo is live',
        bodyAr: `سيظهر شعار «${request.businessName}» حتى ${endsAt.toLocaleDateString('ar-SA')}`,
        bodyEn: `"${request.businessName}" will show until ${endsAt.toLocaleDateString('en-GB')}`,
        data: { tickerRequestId: requestId },
      });

      return this.toDto(updated);
    }

    const status = input.decision === 'REJECT' ? 'REJECTED' : 'STOPPED';
    const updated = await this.prisma.tickerRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewNote: input.reason ?? null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      include: { logoMedia: true },
    });

    await this.audit.record({
      action: input.decision === 'REJECT' ? 'ticker.rejected' : 'ticker.stopped',
      entityType: 'TickerRequest',
      entityId: requestId,
      actorAdminId: adminId,
      reason: input.reason ?? null,
    });

    await this.notifications.notify(
      request.userId,
      input.decision === 'REJECT' ? 'TICKER_REJECTED' : 'TICKER_EXPIRED',
      {
        titleAr: input.decision === 'REJECT' ? 'تم رفض طلب الشعار' : 'تم إيقاف شعارك',
        titleEn: input.decision === 'REJECT' ? 'Ticker request rejected' : 'Ticker logo stopped',
        bodyAr: input.reason ?? 'راجع الشروط ثم أعد الإرسال.',
        bodyEn: input.reason ?? 'Please review the guidelines and resubmit.',
        data: { tickerRequestId: requestId },
      },
    );

    return this.toDto(updated);
  }

  async reorder(adminId: string, order: { id: string; sortWeight: number }[]): Promise<void> {
    await this.prisma.$transaction(
      order.map((entry) =>
        this.prisma.tickerRequest.update({
          where: { id: entry.id },
          data: { sortWeight: entry.sortWeight },
        }),
      ),
    );
    await this.audit.record({
      action: 'ticker.reordered',
      entityType: 'TickerRequest',
      actorAdminId: adminId,
      after: order,
    });
  }
}

/** يمنع تكرار الشعار نفسه مرتين متتاليتين داخل الشريط. */
export function dedupeAdjacent(logos: TickerLogoDto[]): TickerLogoDto[] {
  const result: TickerLogoDto[] = [];
  const pending = [...logos];

  while (pending.length) {
    const previous = result[result.length - 1];
    let index = pending.findIndex((logo) => !previous || logo.logoUrl !== previous.logoUrl);
    if (index === -1) index = 0;
    result.push(pending.splice(index, 1)[0]!);
  }

  return result;
}
