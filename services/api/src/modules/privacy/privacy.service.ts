import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SETTING_KEYS } from '@e3lani/config';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { StorageService } from '../../common/services/storage.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

type ConsentType = 'TERMS' | 'PRIVACY' | 'MARKETING';

/**
 * سجلات الموافقة وطلبات بيانات المستخدم.
 * مصمّمة لتلبية متطلبات نظام حماية البيانات الشخصية السعودي (PDPL):
 * إثبات الموافقة بإصدارها ووقتها ومصدرها، وحق الوصول إلى البيانات وحذفها.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* --------------------------- الموافقات ------------------------------- */

  /** يسجّل موافقة موثّقة بإصدار المستند الحالي ووقت ومصدر الموافقة. */
  async recordConsent(
    userId: string,
    type: ConsentType,
    context: { ip?: string | null; userAgent?: string | null; granted?: boolean; version?: string } = {},
  ): Promise<void> {
    const version =
      context.version ??
      (await this.settings.get<string>(
        type === 'PRIVACY' ? SETTING_KEYS.PRIVACY_VERSION : SETTING_KEYS.TERMS_VERSION,
        '1.0',
      ));

    await this.prisma.consentRecord.create({
      data: {
        userId,
        type,
        version: String(version),
        granted: context.granted ?? true,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }

  async recordInitialConsents(
    userId: string,
    context: { ip?: string | null; userAgent?: string | null } = {},
  ): Promise<void> {
    await this.recordConsent(userId, 'TERMS', context);
    await this.recordConsent(userId, 'PRIVACY', context);
  }

  async myConsents(userId: string) {
    const rows = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      version: row.version,
      granted: row.granted,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * هل يحتاج المستخدم لإعادة الموافقة بعد تحديث المستندات؟
   * يقارن آخر موافقة بإصدار المستند الحالي.
   */
  async pendingConsents(userId: string): Promise<{ type: ConsentType; version: string }[]> {
    const pending: { type: ConsentType; version: string }[] = [];

    for (const [type, key] of [
      ['TERMS', SETTING_KEYS.TERMS_VERSION],
      ['PRIVACY', SETTING_KEYS.PRIVACY_VERSION],
    ] as [ConsentType, string][]) {
      const currentVersion = String(await this.settings.get<string>(key, '1.0'));
      const latest = await this.prisma.consentRecord.findFirst({
        where: { userId, type, granted: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest || latest.version !== currentVersion) {
        pending.push({ type, version: currentVersion });
      }
    }

    return pending;
  }

  /* ------------------------ طلبات بيانات المستخدم ---------------------- */

  async createRequest(userId: string, type: 'EXPORT' | 'DELETE', note?: string) {
    const open = await this.prisma.userDataRequest.findFirst({
      where: { userId, type, status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (open) {
      throw new ConflictException({
        message: 'لديك طلب قيد المعالجة بالفعل',
        code: 'DATA_REQUEST_PENDING',
      });
    }

    const request = await this.prisma.userDataRequest.create({
      data: { userId, type, note: note ?? null },
    });

    await this.audit.record({
      action: `privacy.${type.toLowerCase()}_requested`,
      entityType: 'UserDataRequest',
      entityId: request.id,
      actorUserId: userId,
    });

    return {
      id: request.id,
      type: request.type,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    };
  }

  async myRequests(userId: string) {
    const rows = await this.prisma.userDataRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        // رابط تنزيل مؤقت لا يعمل إلا لصاحب الطلب وبصلاحية محدودة
        downloadUrl:
          row.status === 'COMPLETED' && row.resultKey
            ? await this.storage.createDownloadUrl(row.resultKey, 900).catch(() => null)
            : null,
      })),
    );
  }

  /** يجمع كل بيانات المستخدم في ملف JSON واحد ويرفعه للتخزين. */
  async buildExport(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        city: { select: { nameAr: true, nameEn: true } },
        business: true,
        consents: true,
      },
    });

    const [ads, posts, savedAds, savedPosts, reports, appeals, payments, notifications] =
      await Promise.all([
        this.prisma.ad.findMany({ where: { userId }, include: { media: true } }),
        this.prisma.post.findMany({ where: { userId }, include: { media: true } }),
        this.prisma.savedAd.findMany({ where: { userId } }),
        this.prisma.savedPost.findMany({ where: { userId } }),
        this.prisma.report.findMany({ where: { reporterId: userId } }),
        this.prisma.appeal.findMany({ where: { userId } }),
        this.prisma.payment.findMany({ where: { userId }, include: { invoice: true } }),
        this.prisma.notification.findMany({ where: { userId }, take: 500 }),
      ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      notice:
        'هذا الملف يحتوي على كل البيانات الشخصية المرتبطة بحسابك في منصة إعلاني بتاريخ إنشائه.',
      account: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        accountType: user.accountType,
        city: user.city?.nameAr ?? null,
        createdAt: user.createdAt,
      },
      businessProfile: user.business,
      consents: user.consents,
      ads,
      posts,
      saved: { ads: savedAds, posts: savedPosts },
      reports,
      appeals,
      payments,
      notifications,
    };

    const key = `exports/${userId}/${Date.now()}-e3lani-data.json`;
    await this.storage.putObject(
      key,
      Buffer.from(JSON.stringify(payload, replacer, 2), 'utf8'),
      'application/json',
    );
    return key;
  }

  /* ----------------------------- الإدارة ------------------------------- */

  async listRequests(status?: string, limit = 50) {
    const rows = await this.prisma.userDataRequest.findMany({
      where: status ? { status: status as any } : {},
      include: { user: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      note: row.note,
      user: row.user,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  }

  /**
   * تنفيذ طلب المستخدم.
   *  EXPORT + COMPLETED  ← يبني ملف البيانات ويرفعه ويرسل رابطه.
   *  DELETE + COMPLETED  ← يحذف الحساب فعليًا ويوقف كل محتواه.
   */
  async handleRequest(
    adminId: string,
    requestId: string,
    input: { status: 'PROCESSING' | 'COMPLETED' | 'REJECTED'; note?: string },
  ) {
    const request = await this.prisma.userDataRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException({ message: 'الطلب غير موجود', code: 'DATA_REQUEST_NOT_FOUND' });
    }
    if (request.status === 'COMPLETED') {
      throw new BadRequestException({ message: 'الطلب منفَّذ بالفعل', code: 'DATA_REQUEST_DONE' });
    }

    let resultKey: string | null = request.resultKey;

    if (input.status === 'COMPLETED') {
      if (request.type === 'EXPORT') {
        try {
          resultKey = await this.buildExport(request.userId);
        } catch (error) {
          // فشل التخزين لا يجب أن يظهر كخطأ عام غامض للمسؤول
          throw new BadRequestException({
            message: `تعذّر إنشاء ملف البيانات: ${(error as Error).message}`,
            code: 'DATA_EXPORT_FAILED',
          });
        }
      } else {
        await this.eraseUser(request.userId);
      }
    }

    const updated = await this.prisma.userDataRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        note: input.note ?? request.note,
        resultKey,
        handledById: adminId,
        completedAt: input.status === 'COMPLETED' ? new Date() : null,
      },
    });

    await this.audit.record({
      action: `privacy.request_${input.status.toLowerCase()}`,
      entityType: 'UserDataRequest',
      entityId: requestId,
      actorAdminId: adminId,
      reason: input.note ?? null,
      after: { type: request.type, status: input.status },
    });

    if (input.status !== 'PROCESSING' && request.type === 'EXPORT') {
      await this.notifications.notify(request.userId, 'SYSTEM', {
        titleAr: input.status === 'COMPLETED' ? 'نسخة بياناتك جاهزة' : 'تعذّر تنفيذ طلب بياناتك',
        titleEn: input.status === 'COMPLETED' ? 'Your data export is ready' : 'Data request rejected',
        bodyAr:
          input.status === 'COMPLETED'
            ? 'يمكنك تنزيل نسخة من بياناتك من صفحة الخصوصية خلال ٧ أيام.'
            : (input.note ?? 'يرجى التواصل مع الدعم.'),
        bodyEn:
          input.status === 'COMPLETED'
            ? 'You can download your data from the privacy page within 7 days.'
            : (input.note ?? 'Please contact support.'),
        data: { requestId },
      });
    }

    return updated;
  }

  /** حذف بيانات المستخدم الشخصية مع إبقاء السجلات المالية المطلوبة نظامًا. */
  private async eraseUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.ad.updateMany({ where: { userId }, data: { status: 'REMOVED' } });
      await tx.post.updateMany({ where: { userId }, data: { isActive: false } });
      await tx.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      await tx.pushToken.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          name: 'مستخدم محذوف',
          phone: `deleted:${userId}`,
          email: null,
          avatarMediaId: null,
        },
      });
    });
  }
}

/** يحوّل BigInt و Decimal إلى نص حتى لا يفشل JSON.stringify. */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value && typeof value === 'object' && value.constructor?.name === 'Decimal') {
    return String(value);
  }
  return value;
}
