import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { halalasToSar } from '@e3lani/config';
import type { PricingItemDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';

/** السعر النافذ لخدمة معيّنة، مع معرّف الإصدار الذي أتى منه. */
export interface ResolvedPrice {
  itemId: string;
  key: string;
  nameAr: string;
  nameEn: string;
  versionId: string;
  amountHalalas: number;
  durationDays: number | null;
  effectiveFrom: Date;
}

export interface PricingVersionDto {
  id: string;
  amountHalalas: number;
  amountSar: number;
  durationDays: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED';
  note: string | null;
  createdAt: string;
}

/**
 * الأسعار مؤرَّخة بإصدارات: كل تغيير يضيف صفًا جديدًا ولا يعدّل أو يحذف أي صف سابق.
 * السعر النافذ = الإصدار الذي يقع «الآن» داخل نطاق سريانه.
 * لا يوجد أي سعر مكتوب داخل منطق التطبيق.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* --------------------------- القراءة --------------------------------- */

  private versionStatus(version: { effectiveFrom: Date; effectiveTo: Date | null }, now = new Date()) {
    if (version.effectiveFrom > now) return 'SCHEDULED' as const;
    if (version.effectiveTo && version.effectiveTo <= now) return 'EXPIRED' as const;
    return 'ACTIVE' as const;
  }

  private toVersionDto(version: any): PricingVersionDto {
    return {
      id: version.id,
      amountHalalas: version.amountHalalas,
      amountSar: halalasToSar(version.amountHalalas),
      durationDays: version.durationDays,
      effectiveFrom: version.effectiveFrom.toISOString(),
      effectiveTo: version.effectiveTo ? version.effectiveTo.toISOString() : null,
      status: this.versionStatus(version),
      note: version.note,
      createdAt: version.createdAt.toISOString(),
    };
  }

  /** الإصدار النافذ في لحظة معيّنة — «كم كان السعر يوم كذا؟» باستعلام واحد. */
  async versionAt(key: string, at: Date = new Date()) {
    const item = await this.prisma.pricingItem.findUnique({ where: { key } });
    if (!item) return null;
    return this.prisma.pricingVersion.findFirst({
      where: {
        itemId: item.id,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /** السعر النافذ الآن — يرمي خطأ إذا كانت الخدمة معطّلة أو بلا سعر. */
  async require(key: string, at: Date = new Date()): Promise<ResolvedPrice> {
    const item = await this.prisma.pricingItem.findFirst({ where: { key, isActive: true } });
    if (!item) {
      throw new NotFoundException({ message: `عنصر التسعير ${key} غير متاح`, code: 'PRICING_NOT_FOUND' });
    }

    const version = await this.prisma.pricingVersion.findFirst({
      where: {
        itemId: item.id,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!version) {
      throw new NotFoundException({
        message: `لا يوجد سعر نافذ للخدمة ${key}`,
        code: 'PRICING_VERSION_NOT_FOUND',
      });
    }

    return {
      itemId: item.id,
      key: item.key,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      versionId: version.id,
      amountHalalas: version.amountHalalas,
      durationDays: version.durationDays,
      effectiveFrom: version.effectiveFrom,
    };
  }

  /** القائمة العامة: كل خدمة مفعّلة بسعرها النافذ الآن. */
  async list(includeInactive = false): Promise<PricingItemDto[]> {
    const now = new Date();
    const items = await this.prisma.pricingItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        versions: {
          where: {
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    return items
      .filter((item) => item.versions.length > 0)
      .map((item) => {
        const version = item.versions[0]!;
        return {
          key: item.key,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          descriptionAr: item.descriptionAr,
          amountHalalas: version.amountHalalas,
          amountSar: halalasToSar(version.amountHalalas),
          durationDays: version.durationDays,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
        };
      });
  }

  /** عرض الإدارة: كل خدمة مع سعرها النافذ وما هو مجدول وتاريخها الكامل. */
  async listForAdmin() {
    const now = new Date();
    const items = await this.prisma.pricingItem.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { versions: { orderBy: { effectiveFrom: 'desc' } } },
    });

    return items.map((item) => {
      const versions = item.versions.map((version) => this.toVersionDto(version));
      return {
        key: item.key,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        descriptionAr: item.descriptionAr,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
        current: versions.find((version) => version.status === 'ACTIVE') ?? null,
        scheduled: versions
          .filter((version) => version.status === 'SCHEDULED')
          .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
        history: versions,
        generatedAt: now.toISOString(),
      };
    });
  }

  async history(key: string): Promise<PricingVersionDto[]> {
    const item = await this.prisma.pricingItem.findUnique({
      where: { key },
      include: { versions: { orderBy: { effectiveFrom: 'desc' } } },
    });
    if (!item) throw new NotFoundException({ message: 'الخدمة غير موجودة', code: 'PRICING_NOT_FOUND' });
    return item.versions.map((version) => this.toVersionDto(version));
  }

  /* --------------------------- الكتابة --------------------------------- */

  /** تعديل تعريف الخدمة (الأسماء والتفعيل والترتيب) — لا يمس السعر. */
  async upsertItem(
    adminId: string,
    input: {
      key: string;
      nameAr: string;
      nameEn: string;
      descriptionAr?: string;
      isActive: boolean;
      sortOrder: number;
    },
  ) {
    const before = await this.prisma.pricingItem.findUnique({ where: { key: input.key } });
    const item = await this.prisma.pricingItem.upsert({
      where: { key: input.key },
      update: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
      create: {
        key: input.key,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });

    await this.audit.record({
      action: before ? 'pricing.item_updated' : 'pricing.item_created',
      entityType: 'PricingItem',
      entityId: item.id,
      actorAdminId: adminId,
      before: before ? { nameAr: before.nameAr, isActive: before.isActive } : null,
      after: { nameAr: item.nameAr, isActive: item.isActive },
    });

    return item;
  }

  /**
   * إضافة إصدار سعر جديد (فوري أو مجدول).
   * يُغلق الإصدار السائد عند تاريخ البدء ويتسلسل مع أي إصدار مجدول لاحق.
   */
  async addVersion(
    adminId: string,
    key: string,
    input: {
      amountHalalas: number;
      durationDays?: number | null;
      effectiveFrom?: Date;
      note?: string;
    },
  ): Promise<PricingVersionDto> {
    const item = await this.prisma.pricingItem.findUnique({ where: { key } });
    if (!item) throw new NotFoundException({ message: 'الخدمة غير موجودة', code: 'PRICING_NOT_FOUND' });

    const now = new Date();
    const effectiveFrom = input.effectiveFrom ?? now;

    // منع تزوير التاريخ: لا يمكن إدراج سعر بأثر رجعي
    if (effectiveFrom.getTime() < now.getTime() - 60_000) {
      throw new BadRequestException({
        message: 'لا يمكن جدولة سعر بتاريخ ماضٍ — السجل التاريخي غير قابل للتعديل',
        code: 'PRICING_PAST_DATE',
      });
    }

    const duplicate = await this.prisma.pricingVersion.findFirst({
      where: { itemId: item.id, effectiveFrom },
    });
    if (duplicate) {
      throw new BadRequestException({
        message: 'يوجد إصدار بنفس تاريخ البدء',
        code: 'PRICING_VERSION_CONFLICT',
      });
    }

    const version = await this.prisma.$transaction(async (tx) => {
      // الإصدار المجدول التالي (إن وجد) يحدد نهاية سريان الإصدار الجديد
      const next = await tx.pricingVersion.findFirst({
        where: { itemId: item.id, effectiveFrom: { gt: effectiveFrom } },
        orderBy: { effectiveFrom: 'asc' },
      });

      // الإصدار السائد عند تاريخ البدء يُغلق عند هذا التاريخ
      const covering = await tx.pricingVersion.findFirst({
        where: {
          itemId: item.id,
          effectiveFrom: { lte: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (covering) {
        await tx.pricingVersion.update({
          where: { id: covering.id },
          data: { effectiveTo: effectiveFrom },
        });
      }

      return tx.pricingVersion.create({
        data: {
          itemId: item.id,
          amountHalalas: input.amountHalalas,
          durationDays: input.durationDays ?? null,
          effectiveFrom,
          effectiveTo: next?.effectiveFrom ?? null,
          note: input.note ?? null,
          createdById: adminId,
        },
      });
    });

    await this.audit.record({
      action: 'pricing.version_added',
      entityType: 'PricingVersion',
      entityId: version.id,
      actorAdminId: adminId,
      reason: input.note ?? null,
      after: {
        key,
        amountHalalas: version.amountHalalas,
        durationDays: version.durationDays,
        effectiveFrom: version.effectiveFrom,
      },
    });

    return this.toVersionDto(version);
  }

  /** إلغاء إصدار مجدول لم يبدأ بعد، وإعادة فتح الإصدار السابق. */
  async cancelScheduled(adminId: string, versionId: string): Promise<void> {
    const version = await this.prisma.pricingVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException({ message: 'الإصدار غير موجود', code: 'PRICING_VERSION_NOT_FOUND' });
    }
    if (version.effectiveFrom <= new Date()) {
      throw new BadRequestException({
        message: 'لا يمكن إلغاء إصدار بدأ سريانه — أضف إصدارًا جديدًا بدلًا من ذلك',
        code: 'PRICING_VERSION_STARTED',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.pricingVersion.findFirst({
        where: { itemId: version.itemId, effectiveTo: version.effectiveFrom },
      });
      await tx.pricingVersion.delete({ where: { id: versionId } });
      if (previous) {
        await tx.pricingVersion.update({
          where: { id: previous.id },
          data: { effectiveTo: version.effectiveTo },
        });
      }
    });

    await this.audit.record({
      action: 'pricing.version_cancelled',
      entityType: 'PricingVersion',
      entityId: versionId,
      actorAdminId: adminId,
      before: { amountHalalas: version.amountHalalas, effectiveFrom: version.effectiveFrom },
    });
  }

  /** التراجع: يضيف إصدارًا جديدًا بقيمة الإصدار السابق اعتبارًا من الآن. */
  async rollback(adminId: string, key: string): Promise<PricingVersionDto> {
    const item = await this.prisma.pricingItem.findUnique({ where: { key } });
    if (!item) throw new NotFoundException({ message: 'الخدمة غير موجودة', code: 'PRICING_NOT_FOUND' });

    const now = new Date();
    const current = await this.prisma.pricingVersion.findFirst({
      where: {
        itemId: item.id,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!current) {
      throw new NotFoundException({ message: 'لا يوجد سعر نافذ', code: 'PRICING_VERSION_NOT_FOUND' });
    }

    const previous = await this.prisma.pricingVersion.findFirst({
      where: { itemId: item.id, effectiveFrom: { lt: current.effectiveFrom } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!previous) {
      throw new BadRequestException({
        message: 'لا يوجد إصدار سابق للرجوع إليه',
        code: 'PRICING_NO_PREVIOUS_VERSION',
      });
    }

    return this.addVersion(adminId, key, {
      amountHalalas: previous.amountHalalas,
      durationDays: previous.durationDays,
      note: `تراجع إلى سعر ${halalasToSar(previous.amountHalalas)} ريال`,
    });
  }

  async setActive(adminId: string, key: string, isActive: boolean) {
    const item = await this.prisma.pricingItem.update({ where: { key }, data: { isActive } });
    await this.audit.record({
      action: 'pricing.toggled',
      entityType: 'PricingItem',
      entityId: item.id,
      actorAdminId: adminId,
      after: { isActive },
    });
    return item;
  }
}
