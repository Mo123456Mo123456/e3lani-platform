import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdDto, MediaDto, PostDto, PublicAccountDto } from '@e3lani/types';
import { StorageService } from './storage.service';

type MediaRow = {
  id: string;
  type: string;
  status: string;
  originalKey: string;
  playbackKey: string | null;
  thumbnailKey: string | null;
  variants: unknown;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  blurhash: string | null;
};

/** يحوّل صفوف قاعدة البيانات إلى كائنات عرض عامة مع روابط الوسائط الكاملة. */
@Injectable()
export class SerializerService {
  private readonly siteUrl: string;

  constructor(
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.siteUrl = (config.get<string>('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  media(row: MediaRow | null | undefined): MediaDto | null {
    if (!row) return null;
    const variants = Array.isArray(row.variants)
      ? (row.variants as { name: string; key: string; width?: number; height?: number }[]).map(
          (variant) => ({
            name: variant.name,
            url: this.storage.publicUrlFor(variant.key) ?? '',
            width: variant.width,
            height: variant.height,
          }),
        )
      : [];
    const aspectRatio = row.width && row.height ? Number((row.width / row.height).toFixed(4)) : null;
    return {
      id: row.id,
      type: row.type as MediaDto['type'],
      status: row.status as MediaDto['status'],
      url: this.storage.publicUrlFor(row.playbackKey ?? row.originalKey),
      thumbnailUrl: this.storage.publicUrlFor(row.thumbnailKey),
      posterUrl: this.storage.publicUrlFor(row.thumbnailKey),
      width: row.width,
      height: row.height,
      aspectRatio,
      durationMs: row.durationMs,
      blurhash: row.blurhash,
      variants,
    };
  }

  mediaList(rows: { media: MediaRow; order: number }[]): MediaDto[] {
    return rows
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((row) => this.media(row.media))
      .filter((item): item is MediaDto => Boolean(item));
  }

  account(user: any): PublicAccountDto {
    const business = user.business
      ? {
          displayName: user.business.displayName ?? null,
          bio: user.business.bio ?? null,
          logoUrl: this.storage.publicUrlFor(user.business.logoMedia?.playbackKey ?? user.business.logoMedia?.originalKey),
          coverUrl: this.storage.publicUrlFor(user.business.coverMedia?.playbackKey ?? user.business.coverMedia?.originalKey),
          storeUrl: user.business.storeUrl ?? null,
          websiteUrl: user.business.websiteUrl ?? null,
          whatsapp: user.business.whatsapp ?? null,
          contactPhone: user.business.contactPhone ?? null,
          socials: (user.business.socials as Record<string, string> | null) ?? null,
        }
      : null;

    return {
      id: user.id,
      name: user.business?.displayName ?? user.name ?? 'مستخدم',
      accountType: user.accountType,
      avatarUrl: this.storage.publicUrlFor(
        user.avatarMedia?.playbackKey ?? user.avatarMedia?.originalKey,
      ),
      cityId: user.cityId ?? null,
      cityNameAr: user.city?.nameAr ?? null,
      cityNameEn: user.city?.nameEn ?? null,
      isVerified: Boolean(user.isVerified || user.business?.verifiedAt),
      business,
    };
  }

  ad(row: any, options: { viewerId?: string | null; isSaved?: boolean } = {}): AdDto {
    const now = Date.now();
    const isOwner = options.viewerId && options.viewerId === row.userId;
    const isActive = row.status === 'ACTIVE';
    const isHighlighted = Boolean(row.highlightUntil && new Date(row.highlightUntil).getTime() > now);
    const isTop = Boolean(
      row.topOfCategoryUntil && new Date(row.topOfCategoryUntil).getTime() > now,
    );

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      price: row.price === null || row.price === undefined ? null : Number(row.price),
      currency: row.currency ?? 'SAR',
      status: row.status,
      reachScope: row.reachScope,
      contactMethod: row.contactMethod,
      // قيمة التواصل تُعرض فقط للإعلانات النشطة أو لصاحب الإعلان
      contactValue: isActive || isOwner ? row.contactValue : null,
      city: row.city
        ? { id: row.city.id, nameAr: row.city.nameAr, nameEn: row.city.nameEn }
        : null,
      category: row.category
        ? {
            id: row.category.id,
            slug: row.category.slug,
            nameAr: row.category.nameAr,
            nameEn: row.category.nameEn,
          }
        : null,
      subcategory: row.subcategory
        ? {
            id: row.subcategory.id,
            slug: row.subcategory.slug,
            nameAr: row.subcategory.nameAr,
            nameEn: row.subcategory.nameEn,
          }
        : null,
      media: this.mediaList(row.media ?? []),
      owner: this.account(row.user ?? {}),
      isHighlighted,
      isTopOfCategory: isTop,
      isPromoted: isHighlighted || isTop,
      impressionSource: isHighlighted || isTop ? 'PROMOTED' : 'ORGANIC',
      viewsCount: row.viewsCount ?? 0,
      savesCount: row.savesCount ?? 0,
      sharesCount: row.sharesCount ?? 0,
      isSaved: Boolean(options.isSaved),
      publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      shareUrl: `${this.siteUrl}/ad/${row.id}`,
    };
  }

  post(row: any, options: { isSaved?: boolean } = {}): PostDto {
    return {
      id: row.id,
      caption: row.caption,
      media: this.mediaList(row.media ?? []),
      owner: this.account(row.user ?? {}),
      isSaved: Boolean(options.isSaved),
      createdAt: new Date(row.createdAt).toISOString(),
      shareUrl: `${this.siteUrl}/post/${row.id}`,
    };
  }

  accountShareUrl(userId: string): string {
    return `${this.siteUrl}/u/${userId}`;
  }
}
