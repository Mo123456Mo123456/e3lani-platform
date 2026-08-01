import { Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { permissionsForRole, type AdminRoleKey } from '@e3lani/config';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuditService } from '../../common/services/audit.service';
import { StorageService } from '../../common/services/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CatalogService } from '../catalog/catalog.service';
import { AdsService } from '../ads/ads.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly catalog: CatalogService,
    private readonly ads: AdsService,
  ) {}

  /* ----------------------------- المستخدمون ---------------------------- */

  async listUsers(query: { q?: string; status?: string; limit: number; cursor?: string }) {
    const rows = await this.prisma.user.findMany({
      where: {
        status: query.status ? (query.status as any) : { not: 'DELETED' },
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' as const } },
                { phone: { contains: query.q } },
                { email: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        city: { select: { nameAr: true, nameEn: true } },
        business: { select: { displayName: true, verifiedAt: true } },
        _count: { select: { ads: true, posts: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        accountType: row.accountType,
        status: row.status,
        isVerified: row.isVerified,
        city: row.city?.nameAr ?? null,
        businessName: row.business?.displayName ?? null,
        businessVerified: Boolean(row.business?.verifiedAt),
        adsCount: row._count.ads,
        postsCount: row._count.posts,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length === query.limit ? rows[rows.length - 1]!.id : null,
      hasMore: rows.length === query.limit,
    };
  }

  async setUserStatus(adminId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        suspendedReason: status === 'SUSPENDED' ? reason : null,
        suspendedAt: status === 'SUSPENDED' ? new Date() : null,
      },
    });

    if (status === 'SUSPENDED') {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.prisma.ad.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      });
    }

    await this.audit.record({
      action: status === 'SUSPENDED' ? 'user.suspended' : 'user.reactivated',
      entityType: 'User',
      entityId: userId,
      actorAdminId: adminId,
      reason,
    });

    await this.notifications.notify(
      userId,
      status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'SYSTEM',
      {
        titleAr: status === 'SUSPENDED' ? 'تم إيقاف حسابك' : 'تمت إعادة تفعيل حسابك',
        titleEn: status === 'SUSPENDED' ? 'Account suspended' : 'Account reactivated',
        bodyAr: reason,
        bodyEn: reason,
        data: {},
      },
    );

    return { id: userId, status };
  }

  async verifyBusiness(adminId: string, userId: string, verified: boolean) {
    const profile = await this.prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException({ message: 'لا يوجد حساب تجاري', code: 'BUSINESS_NOT_FOUND' });
    }

    await this.prisma.businessProfile.update({
      where: { userId },
      data: { verifiedAt: verified ? new Date() : null, verifiedBy: verified ? adminId : null },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { isVerified: verified } });

    await this.audit.record({
      action: verified ? 'business.verified' : 'business.unverified',
      entityType: 'BusinessProfile',
      entityId: profile.id,
      actorAdminId: adminId,
    });

    if (verified) {
      await this.notifications.notify(userId, 'ACCOUNT_VERIFIED', {
        titleAr: 'تم توثيق حسابك',
        titleEn: 'Account verified',
        bodyAr: 'أصبح حسابك موثّقًا في منصة إعلاني.',
        bodyEn: 'Your account is now verified on E3lani.',
        data: {},
      });
    }

    return { userId, verified };
  }

  /* ------------------------- مستخدمو لوحة الإدارة ---------------------- */

  async listAdmins() {
    const rows = await this.prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.isActive,
      permissions: permissionsForRole(row.role as AdminRoleKey),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createAdmin(
    actorId: string,
    input: { email: string; name: string; password: string; role: AdminRoleKey },
  ) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const admin = await this.prisma.adminUser.create({
      data: { email: input.email, name: input.name, passwordHash, role: input.role },
    });
    await this.audit.record({
      action: 'admin.created',
      entityType: 'AdminUser',
      entityId: admin.id,
      actorAdminId: actorId,
      after: { email: admin.email, role: admin.role },
    });
    return { id: admin.id, email: admin.email, role: admin.role };
  }

  async setAdminActive(actorId: string, adminId: string, isActive: boolean) {
    const admin = await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { isActive },
    });
    await this.audit.record({
      action: isActive ? 'admin.enabled' : 'admin.disabled',
      entityType: 'AdminUser',
      entityId: adminId,
      actorAdminId: actorId,
    });
    return { id: admin.id, isActive: admin.isActive };
  }

  /* ------------------------------ الإعلانات ---------------------------- */

  async listAds(query: { q?: string; status?: string; limit: number; cursor?: string }) {
    const rows = await this.prisma.ad.findMany({
      where: {
        status: query.status ? (query.status as any) : undefined,
        ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        city: { select: { nameAr: true } },
        category: { select: { nameAr: true } },
        media: { include: { media: true }, orderBy: { order: 'asc' as const }, take: 1 },
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        owner: row.user,
        city: row.city.nameAr,
        category: row.category.nameAr,
        price: row.price ? Number(row.price) : null,
        thumbnailUrl: this.storage.publicUrlFor(
          row.media[0]?.media.thumbnailKey ?? row.media[0]?.media.originalKey,
        ),
        reportsCount: row._count.reports,
        viewsCount: row.viewsCount,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length === query.limit ? rows[rows.length - 1]!.id : null,
      hasMore: rows.length === query.limit,
    };
  }

  async moderateAd(
    adminId: string,
    adId: string,
    input: { action: 'SUSPEND' | 'RESTORE' | 'DELETE' | 'REJECT'; reason: string; notifyOwner: boolean },
  ) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException({ message: 'الإعلان غير موجود', code: 'AD_NOT_FOUND' });

    const statusMap = {
      SUSPEND: 'PAUSED',
      RESTORE: 'ACTIVE',
      DELETE: 'REMOVED',
      REJECT: 'REJECTED',
    } as const;

    const updated = await this.prisma.ad.update({
      where: { id: adId },
      data: {
        status: statusMap[input.action],
        moderationNote: input.action === 'RESTORE' ? null : input.reason,
        rejectionReason: input.action === 'REJECT' ? input.reason : null,
        suspendedAt: input.action === 'RESTORE' ? null : new Date(),
      },
    });

    await this.ads.recordRevision(adId, ad, updated, {
      adminId,
      reason: input.reason,
    });

    await this.audit.record({
      action: `ad.${input.action.toLowerCase()}`,
      entityType: 'Ad',
      entityId: adId,
      actorAdminId: adminId,
      reason: input.reason,
      before: { status: ad.status },
      after: { status: statusMap[input.action] },
    });

    if (input.notifyOwner) {
      const restored = input.action === 'RESTORE';
      await this.notifications.notify(ad.userId, restored ? 'AD_RESTORED' : 'AD_SUSPENDED', {
        titleAr: restored ? 'تمت إعادة تفعيل إعلانك' : 'تم إيقاف إعلانك',
        titleEn: restored ? 'Your ad was restored' : 'Your ad was suspended',
        bodyAr: input.reason,
        bodyEn: input.reason,
        data: { adId, canAppeal: !restored },
      });
    }

    return { id: adId, status: statusMap[input.action] };
  }

  async listPosts(query: { q?: string; limit: number; cursor?: string }) {
    const rows = await this.prisma.post.findMany({
      where: query.q ? { caption: { contains: query.q, mode: 'insensitive' } } : {},
      include: {
        user: { select: { id: true, name: true, phone: true } },
        media: { include: { media: true }, take: 1 },
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        caption: row.caption,
        isActive: row.isActive,
        owner: row.user,
        thumbnailUrl: this.storage.publicUrlFor(
          row.media[0]?.media.thumbnailKey ?? row.media[0]?.media.originalKey,
        ),
        reportsCount: row._count.reports,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length === query.limit ? rows[rows.length - 1]!.id : null,
      hasMore: rows.length === query.limit,
    };
  }

  async moderatePost(adminId: string, postId: string, isActive: boolean, reason: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException({ message: 'المنشور غير موجود', code: 'POST_NOT_FOUND' });

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        isActive,
        removedAt: isActive ? null : new Date(),
        removalReason: isActive ? null : reason,
      },
    });

    await this.audit.record({
      action: isActive ? 'post.restored' : 'post.removed',
      entityType: 'Post',
      entityId: postId,
      actorAdminId: adminId,
      reason,
    });

    if (!isActive) {
      await this.notifications.notify(post.userId, 'POST_REMOVED', {
        titleAr: 'تم إيقاف منشورك',
        titleEn: 'Your post was removed',
        bodyAr: reason,
        bodyEn: reason,
        data: { postId, canAppeal: true },
      });
    }

    return { id: postId, isActive };
  }

  /* ------------------------------ الكتالوج ----------------------------- */

  async upsertCategory(adminId: string, input: any) {
    const row = await this.prisma.category.upsert({
      where: { slug: input.slug },
      update: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        icon: input.icon ?? null,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      create: {
        slug: input.slug,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        icon: input.icon ?? null,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
    await this.catalog.invalidate();
    await this.audit.record({
      action: 'category.upserted',
      entityType: 'Category',
      entityId: row.id,
      actorAdminId: adminId,
      after: { slug: row.slug, isActive: row.isActive },
    });
    return row;
  }

  async upsertCity(adminId: string, input: any) {
    const row = await this.prisma.city.upsert({
      where: { slug: input.slug },
      update: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        regionId: input.regionId,
        lat: input.lat,
        lng: input.lng,
        isPopular: input.isPopular,
        isActive: input.isActive,
      },
      create: {
        slug: input.slug,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        regionId: input.regionId,
        lat: input.lat,
        lng: input.lng,
        isPopular: input.isPopular,
        isActive: input.isActive,
      },
    });
    await this.catalog.invalidate();
    await this.audit.record({
      action: 'city.upserted',
      entityType: 'City',
      entityId: row.id,
      actorAdminId: adminId,
    });
    return row;
  }

  /* ------------------------------ المدفوعات ---------------------------- */

  async listPayments(query: { status?: string; limit: number; cursor?: string }) {
    const rows = await this.prisma.payment.findMany({
      where: query.status ? { status: query.status as any } : {},
      include: {
        user: { select: { id: true, name: true, phone: true } },
        ad: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return {
      items: rows,
      nextCursor: rows.length === query.limit ? rows[rows.length - 1]!.id : null,
      hasMore: rows.length === query.limit,
    };
  }

  /* ------------------------- الإعدادات وسجل الإجراءات ------------------ */

  async listSettings() {
    return this.settings.all();
  }

  async updateSetting(adminId: string, key: string, value: unknown) {
    const before = await this.prisma.appSetting.findUnique({ where: { key } });
    await this.settings.set(key, value, adminId);
    await this.audit.record({
      action: 'setting.updated',
      entityType: 'AppSetting',
      entityId: key,
      actorAdminId: adminId,
      before: before?.value ?? null,
      after: value,
    });
    return { key, value };
  }

  async listAuditLogs(query: { limit: number; cursor?: string; entityType?: string }) {
    const rows = await this.prisma.auditLog.findMany({
      where: query.entityType ? { entityType: query.entityType } : {},
      include: { actorAdmin: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return {
      items: rows,
      nextCursor: rows.length === query.limit ? rows[rows.length - 1]!.id : null,
      hasMore: rows.length === query.limit,
    };
  }

  async broadcast(
    adminId: string,
    input: {
      userIds?: string[];
      audience?: 'ALL' | 'BUSINESS' | 'INDIVIDUAL';
      titleAr: string;
      titleEn: string;
      bodyAr: string;
      bodyEn: string;
      data?: Record<string, unknown>;
    },
  ) {
    let userIds = input.userIds ?? [];
    if (!userIds.length && input.audience) {
      const users = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          ...(input.audience === 'BUSINESS'
            ? { accountType: { not: 'INDIVIDUAL' as const } }
            : input.audience === 'INDIVIDUAL'
              ? { accountType: 'INDIVIDUAL' as const }
              : {}),
        },
        select: { id: true },
        take: 5000,
      });
      userIds = users.map((user) => user.id);
    }

    const sent = await this.notifications.notifyMany(userIds, 'SYSTEM', input);
    await this.audit.record({
      action: 'notification.broadcast',
      entityType: 'Notification',
      actorAdminId: adminId,
      after: { count: sent, audience: input.audience ?? 'custom' },
    });
    return { sent };
  }
}
