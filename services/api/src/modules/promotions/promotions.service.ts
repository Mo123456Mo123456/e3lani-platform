import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PRICING_KEYS } from '@e3lani/config';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';

export type PromotionKey =
  | 'REPUBLISH'
  | 'EXTEND_15'
  | 'HIGHLIGHT_3'
  | 'HIGHLIGHT_7'
  | 'TOP_OF_CATEGORY'
  | 'EXTRA_CITY';

const DAY_MS = 86_400_000;

/**
 * تطبيق خدمات الترويج على الإعلان.
 * كل المدد والأسعار تُقرأ من جدول الأسعار في قاعدة البيانات.
 */
@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async apply(
    adId: string,
    type: PromotionKey,
    options: { paymentId?: string | null; extraCityIds?: string[]; grantedByAdminId?: string | null } = {},
  ): Promise<void> {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });

    const pricingItem = await this.pricing.require(type);
    const days = pricingItem.durationDays ?? 0;
    const now = new Date();

    switch (type) {
      case 'REPUBLISH': {
        await this.prisma.ad.update({
          where: { id: adId },
          data: { lastBumpedAt: now, status: ad.status === 'EXPIRED' ? 'ACTIVE' : ad.status },
        });
        break;
      }
      case 'EXTEND_15': {
        const base = ad.expiresAt && ad.expiresAt > now ? ad.expiresAt : now;
        await this.prisma.ad.update({
          where: { id: adId },
          data: {
            expiresAt: new Date(base.getTime() + days * DAY_MS),
            status: ad.status === 'EXPIRED' ? 'ACTIVE' : ad.status,
          },
        });
        break;
      }
      case 'HIGHLIGHT_3':
      case 'HIGHLIGHT_7': {
        const base = ad.highlightUntil && ad.highlightUntil > now ? ad.highlightUntil : now;
        await this.prisma.ad.update({
          where: { id: adId },
          data: { highlightUntil: new Date(base.getTime() + days * DAY_MS) },
        });
        break;
      }
      case 'TOP_OF_CATEGORY': {
        const base =
          ad.topOfCategoryUntil && ad.topOfCategoryUntil > now ? ad.topOfCategoryUntil : now;
        await this.prisma.ad.update({
          where: { id: adId },
          data: { topOfCategoryUntil: new Date(base.getTime() + days * DAY_MS) },
        });
        break;
      }
      case 'EXTRA_CITY': {
        const cityIds = [...new Set(options.extraCityIds ?? [])].filter((id) => id !== ad.cityId);
        if (!cityIds.length) {
          throw new BadRequestException({ message: 'حدّد مدينة إضافية', code: 'CITY_REQUIRED' });
        }
        const cities = await this.prisma.city.findMany({
          where: { id: { in: cityIds }, isActive: true },
          select: { id: true },
        });
        await this.prisma.adCity.createMany({
          data: cities.map((city) => ({ adId, cityId: city.id })),
          skipDuplicates: true,
        });
        break;
      }
      default:
        throw new BadRequestException({ message: 'نوع ترويج غير معروف', code: 'PROMOTION_UNKNOWN' });
    }

    const endsAt = days ? new Date(now.getTime() + days * DAY_MS) : null;
    await this.prisma.promotion.create({
      data: {
        adId,
        type,
        amountHalalas: options.paymentId ? pricingItem.amountHalalas : 0,
        pricingVersionId: pricingItem.versionId,
        paymentId: options.paymentId ?? null,
        startsAt: now,
        endsAt,
        metadata: options.extraCityIds ? { extraCityIds: options.extraCityIds } : undefined,
      },
    });

    await this.audit.record({
      action: 'promotion.applied',
      entityType: 'Ad',
      entityId: adId,
      actorUserId: options.grantedByAdminId ? null : ad.userId,
      actorAdminId: options.grantedByAdminId ?? null,
      after: { type, endsAt },
    });

    await this.notifications.notify(ad.userId, 'AD_PROMOTED', {
      titleAr: 'تم تفعيل خدمة الترويج',
      titleEn: 'Promotion activated',
      bodyAr: `تم تفعيل «${pricingItem.nameAr}» على إعلان «${ad.title}»`,
      bodyEn: `"${pricingItem.nameEn}" is now active on "${ad.title}"`,
      data: { adId, type },
    });
  }

  async listForAd(adId: string) {
    return this.prisma.promotion.findMany({
      where: { adId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static isPromotionKey(key: string): key is PromotionKey {
    return (
      [
        PRICING_KEYS.REPUBLISH,
        PRICING_KEYS.EXTEND_15,
        PRICING_KEYS.HIGHLIGHT_3,
        PRICING_KEYS.HIGHLIGHT_7,
        PRICING_KEYS.TOP_OF_CATEGORY,
        PRICING_KEYS.EXTRA_CITY,
      ] as string[]
    ).includes(key);
  }
}
