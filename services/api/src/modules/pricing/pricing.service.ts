import { Injectable, NotFoundException } from '@nestjs/common';
import { halalasToSar } from '@e3lani/config';
import type { PricingItemDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';

/**
 * الأسعار تُقرأ دائمًا من قاعدة البيانات وتُدار من لوحة الإدارة فقط.
 * لا يوجد أي سعر مكتوب داخل منطق التطبيق.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toDto(row: any): PricingItemDto {
    return {
      key: row.key,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      descriptionAr: row.descriptionAr,
      amountHalalas: row.amountHalalas,
      amountSar: halalasToSar(row.amountHalalas),
      durationDays: row.durationDays,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }

  async list(includeInactive = false): Promise<PricingItemDto[]> {
    const rows = await this.prisma.pricingItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async require(key: string) {
    const item = await this.prisma.pricingItem.findFirst({ where: { key, isActive: true } });
    if (!item) {
      throw new NotFoundException({ message: `عنصر التسعير ${key} غير متاح`, code: 'PRICING_NOT_FOUND' });
    }
    return item;
  }

  async upsert(adminId: string, input: any): Promise<PricingItemDto> {
    const before = await this.prisma.pricingItem.findUnique({ where: { key: input.key } });
    const row = await this.prisma.pricingItem.upsert({
      where: { key: input.key },
      update: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr ?? null,
        amountHalalas: input.amountHalalas,
        durationDays: input.durationDays ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
      create: {
        key: input.key,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr ?? null,
        amountHalalas: input.amountHalalas,
        durationDays: input.durationDays ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });

    await this.audit.record({
      action: before ? 'pricing.updated' : 'pricing.created',
      entityType: 'PricingItem',
      entityId: row.id,
      actorAdminId: adminId,
      before: before ? { amountHalalas: before.amountHalalas, isActive: before.isActive } : null,
      after: { amountHalalas: row.amountHalalas, isActive: row.isActive },
    });

    return this.toDto(row);
  }

  async setActive(adminId: string, key: string, isActive: boolean): Promise<PricingItemDto> {
    const row = await this.prisma.pricingItem.update({ where: { key }, data: { isActive } });
    await this.audit.record({
      action: 'pricing.toggled',
      entityType: 'PricingItem',
      entityId: row.id,
      actorAdminId: adminId,
      after: { isActive },
    });
    return this.toDto(row);
  }
}
