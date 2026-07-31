import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUserDto } from '@e3lani/types';
import { PrismaService } from '../../common/services/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async updateProfile(
    userId: string,
    input: {
      name?: string;
      cityId?: string;
      email?: string | null;
      avatarMediaId?: string | null;
      locale?: 'ar' | 'en';
    },
  ): Promise<SessionUserDto> {
    if (input.cityId) {
      const city = await this.prisma.city.findFirst({
        where: { id: input.cityId, isActive: true },
        select: { id: true },
      });
      if (!city) throw new NotFoundException({ message: 'المدينة غير موجودة', code: 'CITY_NOT_FOUND' });
    }

    if (input.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: input.email, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) throw new BadRequestException({ message: 'البريد الإلكتروني مستخدم', code: 'EMAIL_TAKEN' });
    }

    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { accountType: true, email: true, avatarMediaId: true },
    });

    // البريد إلزامي للحسابات التجارية
    if (current.accountType !== 'INDIVIDUAL' && input.email === null) {
      throw new BadRequestException({
        message: 'البريد الإلكتروني مطلوب للحسابات التجارية',
        code: 'EMAIL_REQUIRED',
      });
    }

    if (input.avatarMediaId) {
      await this.assertOwnMedia(userId, input.avatarMediaId, 'AVATAR');
    }

    // العودة للصورة الافتراضية = إرسال avatarMediaId = null
    if (input.avatarMediaId === null && current.avatarMediaId) {
      const previous = await this.prisma.mediaAsset.findUnique({
        where: { id: current.avatarMediaId },
      });
      if (previous) {
        await this.prisma.user.update({ where: { id: userId }, data: { avatarMediaId: null } });
        await this.storage.delete(previous.originalKey);
        if (previous.thumbnailKey) await this.storage.delete(previous.thumbnailKey);
        await this.prisma.mediaAsset.delete({ where: { id: previous.id } }).catch(() => undefined);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name ?? undefined,
        cityId: input.cityId ?? undefined,
        email: input.email === undefined ? undefined : input.email,
        avatarMediaId: input.avatarMediaId === undefined ? undefined : input.avatarMediaId,
        locale: input.locale ?? undefined,
      },
    });

    await this.audit.record({
      action: 'user.profile_updated',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      after: input as any,
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { avatarMedia: true },
    });

    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      accountType: user.accountType,
      status: user.status,
      avatarUrl: this.storage.publicUrlFor(user.avatarMedia?.playbackKey ?? user.avatarMedia?.originalKey),
      cityId: user.cityId,
      isVerified: user.isVerified,
      profileComplete: user.profileCompleted,
      locale: (user.locale as 'ar' | 'en') ?? 'ar',
    };
  }

  async updateBusinessProfile(userId: string, input: Record<string, any>) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { accountType: true },
    });
    if (user.accountType === 'INDIVIDUAL') {
      throw new ForbiddenException({
        message: 'هذه الميزة للحسابات التجارية فقط',
        code: 'BUSINESS_ONLY',
      });
    }

    if (input.logoMediaId) await this.assertOwnMedia(userId, input.logoMediaId, 'LOGO');
    if (input.coverMediaId) await this.assertOwnMedia(userId, input.coverMediaId, 'COVER');

    const profile = await this.prisma.businessProfile.upsert({
      where: { userId },
      update: {
        displayName: input.displayName ?? undefined,
        bio: input.bio === undefined ? undefined : input.bio,
        logoMediaId: input.logoMediaId === undefined ? undefined : input.logoMediaId,
        coverMediaId: input.coverMediaId === undefined ? undefined : input.coverMediaId,
        storeUrl: input.storeUrl === undefined ? undefined : input.storeUrl,
        websiteUrl: input.websiteUrl === undefined ? undefined : input.websiteUrl,
        whatsapp: input.whatsapp === undefined ? undefined : input.whatsapp,
        contactPhone: input.contactPhone === undefined ? undefined : input.contactPhone,
        socials: input.socials === undefined ? undefined : input.socials,
      },
      create: {
        userId,
        displayName: input.displayName,
        bio: input.bio,
        logoMediaId: input.logoMediaId,
        coverMediaId: input.coverMediaId,
        storeUrl: input.storeUrl,
        websiteUrl: input.websiteUrl,
        whatsapp: input.whatsapp,
        contactPhone: input.contactPhone,
        socials: input.socials,
      },
      include: { logoMedia: true, coverMedia: true },
    });

    await this.audit.record({
      action: 'business.profile_updated',
      entityType: 'BusinessProfile',
      entityId: profile.id,
      actorUserId: userId,
    });

    return {
      displayName: profile.displayName,
      bio: profile.bio,
      logoUrl: this.storage.publicUrlFor(profile.logoMedia?.playbackKey ?? profile.logoMedia?.originalKey),
      coverUrl: this.storage.publicUrlFor(profile.coverMedia?.playbackKey ?? profile.coverMedia?.originalKey),
      storeUrl: profile.storeUrl,
      websiteUrl: profile.websiteUrl,
      whatsapp: profile.whatsapp,
      contactPhone: profile.contactPhone,
      socials: profile.socials,
      isVerified: Boolean(profile.verifiedAt),
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED', phone: `deleted:${userId}`, email: null },
    });
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.ad.updateMany({ where: { userId }, data: { status: 'REMOVED' } });
    await this.prisma.post.updateMany({ where: { userId }, data: { isActive: false } });
    await this.audit.record({
      action: 'user.deleted_self',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
    });
  }

  private async assertOwnMedia(userId: string, mediaId: string, purpose: string): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, ownerId: userId },
      select: { purpose: true, status: true },
    });
    if (!media) throw new NotFoundException({ message: 'الوسيط غير موجود', code: 'MEDIA_NOT_FOUND' });
    if (media.purpose !== purpose) {
      throw new BadRequestException({ message: 'وسيط مرفوع لوجهة أخرى', code: 'MEDIA_PURPOSE_MISMATCH' });
    }
    if (media.status === 'FAILED') {
      throw new BadRequestException({ message: 'فشل فحص الملف', code: 'MEDIA_FAILED' });
    }
  }
}
