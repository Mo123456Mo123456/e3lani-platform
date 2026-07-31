import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { AD_LIMITS, PRICING_KEYS } from '@e3lani/config';
import type { AdDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { SerializerService } from '../../common/services/serializer.service';
import { AuditService } from '../../common/services/audit.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { runAutomatedContentCheck } from '../../common/utils/moderation';
import { encodeCursor, decodeCursor, type Paginated } from '../../common/utils/pagination';
import { AD_INCLUDE } from './ads.constants';

interface CreateAdInput {
  title: string;
  description?: string;
  categoryId: string;
  subcategoryId?: string;
  cityId: string;
  reachScope: 'CITY' | 'KINGDOM';
  extraCityIds: string[];
  price?: number | null;
  contactMethod: 'WHATSAPP' | 'PHONE' | 'STORE_LINK' | 'PRODUCT_LINK' | 'EXTERNAL_LINK';
  contactValue: string;
  mediaIds: string[];
}

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly serializer: SerializerService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------ إنشاء ------------------------------- */

  async create(userId: string, input: CreateAdInput): Promise<AdDto> {
    await this.assertProfileComplete(userId);

    if (await this.settings.autoModerationEnabled()) {
      const check = runAutomatedContentCheck({
        title: input.title,
        description: input.description,
        contactValue: input.contactValue,
      });
      if (!check.ok) {
        throw new BadRequestException({
          message: 'تعذّر قبول الإعلان في الفحص الآلي',
          code: 'AUTOMATED_CHECK_FAILED',
          reasons: check.reasons,
        });
      }
    }

    await this.assertCategory(input.categoryId, input.subcategoryId);
    await this.assertCity(input.cityId);
    const orderedMedia = await this.media.assertUsableMedia(userId, input.mediaIds, 'AD');

    const extraCityIds = [...new Set(input.extraCityIds ?? [])].filter((id) => id !== input.cityId);
    if (extraCityIds.length > AD_LIMITS.maxExtraCities) {
      throw new BadRequestException({ message: 'عدد المدن الإضافية كبير', code: 'TOO_MANY_CITIES' });
    }

    const ad = await this.prisma.ad.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId ?? null,
        cityId: input.cityId,
        reachScope: input.reachScope,
        price: input.price ?? null,
        contactMethod: input.contactMethod,
        contactValue: input.contactValue,
        status: 'DRAFT',
        media: {
          create: orderedMedia.map((item, index) => ({ mediaId: item.id, order: index })),
        },
      },
    });

    await this.audit.record({
      action: 'ad.created',
      entityType: 'Ad',
      entityId: ad.id,
      actorUserId: userId,
    });

    return this.getOwned(userId, ad.id);
  }

  /**
   * نشر الإعلان.
   *   الوضع المجاني الحالي: مسودة ← نشط مباشرة بدون مراجعة بشرية.
   *   عند تفعيل الدفع: مسودة ← بانتظار الدفع ← نشط.
   */
  async publish(userId: string, adId: string): Promise<AdDto> {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });

    if (ad.status === 'ACTIVE') {
      throw new ConflictException({ message: 'الإعلان منشور بالفعل', code: 'AD_ALREADY_ACTIVE' });
    }
    if (!['DRAFT', 'PENDING_PAYMENT', 'EXPIRED', 'PAUSED'].includes(ad.status)) {
      throw new ConflictException({ message: 'لا يمكن نشر الإعلان بحالته الحالية', code: 'AD_STATE_INVALID' });
    }

    const mode = await this.settings.publishingMode();
    if (mode === 'PAID') {
      const updated = await this.prisma.ad.update({
        where: { id: ad.id },
        data: { status: 'PENDING_PAYMENT' },
      });
      await this.audit.record({
        action: 'ad.pending_payment',
        entityType: 'Ad',
        entityId: ad.id,
        actorUserId: userId,
      });
      return this.serialize(updated.id, userId);
    }

    return this.activate(ad.id, userId, 'free-publishing');
  }

  /** تفعيل الإعلان — يُستدعى من النشر المجاني أو بعد نجاح الدفع. */
  async activate(adId: string, actorUserId: string | null, reason: string): Promise<AdDto> {
    const durationDays = await this.standardDurationDays();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 86_400_000);

    const ad = await this.prisma.ad.update({
      where: { id: adId },
      data: {
        status: 'ACTIVE',
        publishedAt: now,
        lastBumpedAt: now,
        expiresAt,
        rejectionReason: null,
        suspendedAt: null,
      },
    });

    await this.audit.record({
      action: 'ad.activated',
      entityType: 'Ad',
      entityId: adId,
      actorUserId,
      reason,
      after: { expiresAt },
    });

    await this.notifications.notify(ad.userId, 'AD_PUBLISHED', {
      titleAr: 'تم نشر إعلانك',
      titleEn: 'Your ad is live',
      bodyAr: `إعلان «${ad.title}» ظاهر الآن حتى ${expiresAt.toLocaleDateString('ar-SA')}`,
      bodyEn: `Your ad "${ad.title}" is now live until ${expiresAt.toLocaleDateString('en-GB')}`,
      data: { adId },
    });

    return this.serialize(adId, ad.userId);
  }

  async standardDurationDays(): Promise<number> {
    const pricing = await this.prisma.pricingItem.findUnique({
      where: { key: PRICING_KEYS.AD_STANDARD },
      select: { durationDays: true },
    });
    return pricing?.durationDays ?? AD_LIMITS.defaultDurationDays;
  }

  /* ------------------------------ تعديل ------------------------------- */

  async update(userId: string, adId: string, input: Partial<CreateAdInput>): Promise<AdDto> {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
    if (['REMOVED', 'REJECTED'].includes(ad.status)) {
      throw new ForbiddenException({ message: 'لا يمكن تعديل هذا الإعلان', code: 'AD_LOCKED' });
    }

    if (input.title || input.description !== undefined || input.contactValue) {
      const check = runAutomatedContentCheck({
        title: input.title ?? ad.title,
        description: input.description ?? ad.description,
        contactValue: input.contactValue ?? ad.contactValue,
      });
      if (!check.ok) {
        throw new BadRequestException({
          message: 'تعذّر قبول التعديل في الفحص الآلي',
          code: 'AUTOMATED_CHECK_FAILED',
          reasons: check.reasons,
        });
      }
    }

    if (input.categoryId) await this.assertCategory(input.categoryId, input.subcategoryId);
    if (input.cityId) await this.assertCity(input.cityId);

    let mediaUpdate = {};
    if (input.mediaIds) {
      const orderedMedia = await this.media.assertUsableMedia(userId, input.mediaIds, 'AD');
      mediaUpdate = {
        media: {
          deleteMany: {},
          create: orderedMedia.map((item, index) => ({ mediaId: item.id, order: index })),
        },
      };
    }

    await this.prisma.ad.update({
      where: { id: adId },
      data: {
        title: input.title ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        categoryId: input.categoryId ?? undefined,
        subcategoryId: input.subcategoryId === undefined ? undefined : input.subcategoryId,
        cityId: input.cityId ?? undefined,
        reachScope: input.reachScope ?? undefined,
        price: input.price === undefined ? undefined : input.price,
        contactMethod: input.contactMethod ?? undefined,
        contactValue: input.contactValue ?? undefined,
        ...mediaUpdate,
      },
    });

    await this.audit.record({
      action: 'ad.updated',
      entityType: 'Ad',
      entityId: adId,
      actorUserId: userId,
      before: { title: ad.title, status: ad.status },
      after: input as any,
    });

    return this.getOwned(userId, adId);
  }

  async pause(userId: string, adId: string): Promise<AdDto> {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
    if (ad.status !== 'ACTIVE') {
      throw new ConflictException({ message: 'الإعلان غير نشط', code: 'AD_NOT_ACTIVE' });
    }
    await this.prisma.ad.update({ where: { id: adId }, data: { status: 'PAUSED' } });
    await this.audit.record({ action: 'ad.paused', entityType: 'Ad', entityId: adId, actorUserId: userId });
    return this.serialize(adId, userId);
  }

  async resume(userId: string, adId: string): Promise<AdDto> {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
    if (ad.status !== 'PAUSED') {
      throw new ConflictException({ message: 'الإعلان غير متوقف', code: 'AD_NOT_PAUSED' });
    }
    if (ad.expiresAt && ad.expiresAt.getTime() < Date.now()) {
      throw new ConflictException({ message: 'انتهت مدة الإعلان، مدّده أولًا', code: 'AD_EXPIRED' });
    }
    await this.prisma.ad.update({ where: { id: adId }, data: { status: 'ACTIVE' } });
    return this.serialize(adId, userId);
  }

  async remove(userId: string, adId: string): Promise<void> {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
    await this.prisma.ad.delete({ where: { id: adId } });
    await this.audit.record({
      action: 'ad.deleted_by_owner',
      entityType: 'Ad',
      entityId: adId,
      actorUserId: userId,
      before: { title: ad.title },
    });
  }

  /* ------------------------------ قراءة ------------------------------- */

  async getPublic(adId: string, viewerId?: string | null): Promise<AdDto> {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId }, include: AD_INCLUDE });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });

    const isOwner = viewerId && ad.userId === viewerId;
    if (ad.status !== 'ACTIVE' && !isOwner) {
      throw new NotFoundException({ message: 'الإعلان غير متاح', code: 'AD_NOT_AVAILABLE' });
    }

    const isSaved = viewerId
      ? Boolean(
          await this.prisma.savedAd.findUnique({
            where: { userId_adId: { userId: viewerId, adId } },
            select: { adId: true },
          }),
        )
      : false;

    return this.serializer.ad(ad, { viewerId, isSaved });
  }

  async getOwned(userId: string, adId: string): Promise<AdDto> {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId, userId },
      include: AD_INCLUDE,
    });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });
    return this.serializer.ad(ad, { viewerId: userId });
  }

  async listMine(
    userId: string,
    options: { status?: string; cursor?: string; limit: number },
  ): Promise<Paginated<AdDto>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.prisma.ad.findMany({
      where: {
        userId,
        status: options.status ? (options.status as any) : undefined,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.sort) } },
                { createdAt: new Date(cursor.sort), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: AD_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map((ad) => this.serializer.ad(ad, { viewerId: userId })),
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ sort: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async serialize(adId: string, viewerId?: string | null): Promise<AdDto> {
    const ad = await this.prisma.ad.findUniqueOrThrow({ where: { id: adId }, include: AD_INCLUDE });
    return this.serializer.ad(ad, { viewerId });
  }

  async registerShare(adId: string): Promise<void> {
    await this.prisma.ad.updateMany({
      where: { id: adId, status: 'ACTIVE' },
      data: { sharesCount: { increment: 1 } },
    });
  }

  /* ----------------------------- مساعدات ------------------------------ */

  private async assertProfileComplete(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { profileCompleted: true },
    });
    if (!user.profileCompleted) {
      throw new ForbiddenException({
        message: 'أكمل بيانات حسابك قبل إضافة إعلان',
        code: 'PROFILE_INCOMPLETE',
      });
    }
  }

  private async assertCategory(categoryId: string, subcategoryId?: string | null): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, isActive: true, parentId: null },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException({ message: 'القسم الرئيسي غير صالح', code: 'CATEGORY_INVALID' });
    }
    if (subcategoryId) {
      const sub = await this.prisma.category.findFirst({
        where: { id: subcategoryId, isActive: true, parentId: categoryId },
        select: { id: true },
      });
      if (!sub) {
        throw new BadRequestException({ message: 'القسم الفرعي غير صالح', code: 'SUBCATEGORY_INVALID' });
      }
    }
  }

  private async assertCity(cityId: string): Promise<void> {
    const city = await this.prisma.city.findFirst({
      where: { id: cityId, isActive: true },
      select: { id: true },
    });
    if (!city) throw new BadRequestException({ message: 'المدينة غير صالحة', code: 'CITY_INVALID' });
  }
}
