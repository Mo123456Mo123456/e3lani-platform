import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { prisma, Prisma } from "@e3lani/database";
import { parseServerEnv } from "@e3lani/config";
import {
  completeProfileSchema,
  createAdSchema,
  createPostSchema,
  feedQuerySchema,
  reportSchema
} from "@e3lani/types";
import { CurrentUser, type AuthUser, parse, Public } from "./common";
import { z } from "zod";

const env = parseServerEnv();
const businessProfileSchema = z.object({
  bio: z.string().trim().max(500).nullable().optional(),
  websiteUrl: z.string().url().startsWith("https://").nullable().optional(),
  storeUrl: z.string().url().startsWith("https://").nullable().optional(),
  whatsapp: z.string().regex(/^\+9665\d{8}$/).nullable().optional(),
  socialLinks: z.record(z.string(), z.string().url().startsWith("https://")).optional()
});
const appealSchema = z.object({ message: z.string().trim().min(20).max(1000) });
const adInclude = {
  city: { select: { id: true, nameAr: true, nameEn: true } },
  category: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
  subcategory: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
  owner: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      city: { select: { nameAr: true, nameEn: true } },
      businessProfile: {
        select: { logoUrl: true, verifiedAt: true }
      }
    }
  },
  media: {
    orderBy: { sortOrder: "asc" as const },
    include: { media: true }
  }
} satisfies Prisma.AdInclude;

function mediaUrl(key: string | null) {
  return key ? `${env.MEDIA_PUBLIC_URL.replace(/\/$/, "")}/${key}` : null;
}

function presentAd(ad: Prisma.AdGetPayload<{ include: typeof adInclude }>) {
  return {
    ...ad,
    media: ad.media.map(({ media, sortOrder }) => ({
      id: media.id,
      kind: media.kind,
      sortOrder,
      url: mediaUrl(media.optimizedKey),
      thumbnailUrl: mediaUrl(media.thumbnailKey),
      blurHash: media.blurHash,
      width: media.width,
      height: media.height,
      durationMs: media.durationMs
    }))
  };
}

@Injectable()
export class PlatformService {
  async catalog() {
    const [regions, categories] = await Promise.all([
      prisma.region.findMany({
        where: { active: true },
        include: { cities: { where: { active: true }, orderBy: { nameAr: "asc" } } }
      }),
      prisma.category.findMany({
        where: { active: true, parentId: null },
        include: {
          children: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }] }
        },
        orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }]
      })
    ]);
    return { regions, categories };
  }

  async productConfig() {
    const [setting, prices] = await Promise.all([
      prisma.platformSetting.findUnique({ where: { key: "publishing" } }),
      prisma.price.findMany({ where: { active: true }, orderBy: { code: "asc" } })
    ]);
    const publishing = (setting?.value ?? {}) as Record<string, unknown>;
    return {
      publishing: {
        mode: publishing.mode ?? "FREE_LAUNCH",
        paymentsEnabled: env.PAYMENTS_ENABLED,
        adDurationDays: publishing.adDurationDays ?? 30
      },
      prices
    };
  }

  async feed(rawQuery: unknown) {
    const query = parse(feedQuerySchema, rawQuery);
    const where: Prisma.AdWhereInput = {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      ...(query.cityId && query.mode === "NEARBY" ? { cityId: query.cityId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
      ...(query.verified ? { owner: { businessProfile: { verifiedAt: { not: null } } } } : {}),
      ...(query.featured ? { featuredUntil: { gt: new Date() } } : {}),
      ...(query.sponsored ? { sponsoredUntil: { gt: new Date() } } : {}),
      ...(query.media ? { media: { some: { media: { kind: query.media } } } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {})
    };
    const orderBy: Prisma.AdOrderByWithRelationInput[] =
      query.mode === "LATEST" || query.sort === "LATEST"
        ? [{ createdAt: "desc" }]
        : query.sort === "MOST_VIEWED"
          ? [{ metrics: { _count: "desc" } }, { createdAt: "desc" }]
          : [{ sponsoredUntil: "desc" }, { featuredUntil: "desc" }, { createdAt: "desc" }];
    const ads = await prisma.ad.findMany({
      where,
      include: adInclude,
      orderBy,
      take: query.limit
    });
    return {
      items: ads.map(presentAd),
      nextCursor: ads.length === query.limit ? ads.at(-1)?.id : null
    };
  }

  async activeBanners() {
    const banners = await prisma.bannerRequest.findMany({
      where: { status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      include: { media: true },
      orderBy: { startsAt: "desc" }
    });
    const deduped = banners.filter(
      (banner, index) => index === 0 || banner.mediaId !== banners[index - 1]?.mediaId
    );
    return deduped.map((banner) => ({
      id: banner.id,
      logoUrl: mediaUrl(banner.media.optimizedKey ?? banner.media.thumbnailKey)
    }));
  }

  async publicAd(id: string) {
    const ad = await prisma.ad.findFirst({
      where: { id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      include: adInclude
    });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    return presentAd(ad);
  }

  async publicProfile(id: string) {
    const profile = await prisma.user.findFirst({
      where: { id, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        accountType: true,
        city: { select: { nameAr: true, nameEn: true } },
        businessProfile: true,
        ads: {
          where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
          include: adInclude,
          orderBy: { createdAt: "desc" }
        },
        posts: {
          where: { status: "PUBLISHED" },
          include: {
            media: { orderBy: { sortOrder: "asc" }, include: { media: true } }
          },
          orderBy: { publishedAt: "desc" }
        }
      }
    });
    if (!profile) throw new NotFoundException("PROFILE_NOT_FOUND");
    const impressions = await prisma.analyticsEvent.count({
      where: { ad: { ownerId: id }, type: "IMPRESSION" }
    });
    return {
      ...profile,
      ads: profile.ads.map(presentAd),
      posts: profile.posts.map((post) => ({
        ...post,
        media: post.media.map(({ media, sortOrder }) => ({
          id: media.id,
          kind: media.kind,
          sortOrder,
          url: mediaUrl(media.optimizedKey),
          thumbnailUrl: mediaUrl(media.thumbnailKey)
        }))
      })),
      views: impressions
    };
  }

  async updateProfile(userId: string, body: unknown) {
    const data = parse(completeProfileSchema, body);
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
        cityId: data.cityId,
        accountType: data.accountType,
        acceptedTermsAt: new Date(),
        profileCompletedAt: new Date()
      },
      select: { id: true, name: true, email: true, cityId: true, accountType: true, avatarUrl: true }
    });
  }

  async setAvatar(userId: string, assetId: string | null) {
    if (!assetId) {
      return prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    }
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId, kind: "IMAGE", status: "READY" }
    });
    if (!asset?.optimizedKey) throw new BadRequestException("AVATAR_ASSET_NOT_READY");
    return prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: mediaUrl(asset.optimizedKey) }
    });
  }

  async updateBusinessProfile(userId: string, body: unknown) {
    const data = parse(businessProfileSchema, body);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true }
    });
    if (!user || user.accountType === "INDIVIDUAL") {
      throw new BadRequestException("BUSINESS_ACCOUNT_REQUIRED");
    }
    return prisma.businessProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    });
  }

  async setBusinessAsset(userId: string, field: "logoUrl" | "coverUrl", assetId: string | null) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true }
    });
    if (!user || user.accountType === "INDIVIDUAL") {
      throw new BadRequestException("BUSINESS_ACCOUNT_REQUIRED");
    }
    let url: string | null = null;
    if (assetId) {
      const asset = await prisma.mediaAsset.findFirst({
        where: { id: assetId, ownerId: userId, kind: "IMAGE", status: "READY" }
      });
      if (!asset?.optimizedKey) throw new BadRequestException("BUSINESS_ASSET_NOT_READY");
      url = mediaUrl(asset.optimizedKey);
    }
    return prisma.businessProfile.upsert({
      where: { userId },
      update: { [field]: url },
      create: { userId, [field]: url }
    });
  }

  async createAd(userId: string, body: unknown) {
    const input = parse(createAdSchema, body);
    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: input.media.map((item) => item.assetId) }, ownerId: userId, status: "READY" }
    });
    if (assets.length !== input.media.length) throw new BadRequestException("MEDIA_NOT_READY");
    const kinds = new Set(assets.map((asset) => asset.kind));
    if (kinds.size > 1 || (kinds.has("VIDEO") && assets.length !== 1)) {
      throw new BadRequestException("MEDIA_MUST_BE_ONE_VIDEO_OR_IMAGES");
    }
    const subcategory = await prisma.category.findFirst({
      where: { id: input.subcategoryId, parentId: input.categoryId, active: true }
    });
    if (!subcategory) throw new BadRequestException("SUBCATEGORY_MISMATCH");

    const setting = await prisma.platformSetting.findUnique({ where: { key: "publishing" } });
    const mode = ((setting?.value ?? {}) as { mode?: string }).mode ?? "FREE_LAUNCH";
    const requiresPayment = env.PAYMENTS_ENABLED && mode === "PAID_ONLY";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 86_400_000);
    return prisma.$transaction(async (tx) => {
      const ad = await tx.ad.create({
        data: {
          ownerId: userId,
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
          cityId: input.cityId,
          scope: input.scope,
          price: input.price,
          contactType: input.contact.type,
          contactValue: input.contact.value,
          status: requiresPayment ? "AWAITING_PAYMENT" : "ACTIVE",
          activatedAt: requiresPayment ? null : now,
          expiresAt: requiresPayment ? null : expiresAt,
          media: {
            create: input.media.map((item) => ({ mediaId: item.assetId, sortOrder: item.order }))
          }
        },
        include: adInclude
      });
      await tx.notification.create({
        data: {
          userId,
          type: "AD_PUBLISHED",
          titleAr: "تم نشر إعلانك",
          titleEn: "Your ad is live",
          bodyAr: `تم نشر «${ad.title}» مباشرة.`,
          bodyEn: `"${ad.title}" was published successfully.`,
          data: { adId: ad.id }
        }
      });
      return presentAd(ad);
    });
  }

  async createPost(userId: string, body: unknown) {
    const input = parse(createPostSchema, body);
    const count = await prisma.mediaAsset.count({
      where: { id: { in: input.media.map((item) => item.assetId) }, ownerId: userId, status: "READY" }
    });
    if (count !== input.media.length) throw new BadRequestException("MEDIA_NOT_READY");
    return prisma.profilePost.create({
      data: {
        ownerId: userId,
        title: input.title,
        body: input.body,
        status: "PUBLISHED",
        publishedAt: new Date(),
        media: {
          create: input.media.map((item) => ({ mediaId: item.assetId, sortOrder: item.order }))
        }
      },
      include: { media: { include: { media: true }, orderBy: { sortOrder: "asc" } } }
    });
  }

  async updatePost(userId: string, postId: string, body: unknown) {
    const input = parse(createPostSchema, body);
    const post = await prisma.profilePost.findFirst({ where: { id: postId, ownerId: userId } });
    if (!post) throw new NotFoundException("POST_NOT_FOUND");
    const count = await prisma.mediaAsset.count({
      where: { id: { in: input.media.map((item) => item.assetId) }, ownerId: userId, status: "READY" }
    });
    if (count !== input.media.length) throw new BadRequestException("MEDIA_NOT_READY");
    return prisma.$transaction(async (tx) => {
      await tx.postMedia.deleteMany({ where: { postId } });
      return tx.profilePost.update({
        where: { id: postId },
        data: {
          title: input.title,
          body: input.body,
          media: {
            create: input.media.map((item) => ({ mediaId: item.assetId, sortOrder: item.order }))
          }
        },
        include: { media: { include: { media: true }, orderBy: { sortOrder: "asc" } } }
      });
    });
  }

  async deletePost(userId: string, postId: string) {
    const result = await prisma.profilePost.updateMany({
      where: { id: postId, ownerId: userId },
      data: { status: "REMOVED" }
    });
    if (!result.count) throw new NotFoundException("POST_NOT_FOUND");
    return { success: true };
  }

  async togglePostFavorite(userId: string, postId: string, save: boolean) {
    if (save) {
      await prisma.postFavorite.upsert({
        where: { userId_postId: { userId, postId } },
        update: {},
        create: { userId, postId }
      });
    } else {
      await prisma.postFavorite.deleteMany({ where: { userId, postId } });
    }
    return { saved: save };
  }

  myAds(userId: string) {
    return prisma.ad.findMany({
      where: { ownerId: userId },
      include: adInclude,
      orderBy: { createdAt: "desc" }
    }).then((ads) => ads.map(presentAd));
  }

  async changeAdStatus(userId: string, adId: string, action: "PAUSE" | "RESUME" | "REMOVE") {
    const ad = await prisma.ad.findFirst({ where: { id: adId, ownerId: userId } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    const valid =
      (action === "PAUSE" && ad.status === "ACTIVE") ||
      (action === "RESUME" && ad.status === "PAUSED" && Boolean(ad.expiresAt && ad.expiresAt > new Date())) ||
      (action === "REMOVE" && ["ACTIVE", "PAUSED", "DRAFT"].includes(ad.status));
    if (!valid) throw new BadRequestException("AD_ACTION_NOT_ALLOWED");
    return prisma.ad.update({
      where: { id: ad.id },
      data: {
        status: action === "PAUSE" ? "PAUSED" : action === "RESUME" ? "ACTIVE" : "REMOVED",
        removedAt: action === "REMOVE" ? new Date() : undefined
      }
    });
  }

  async createBannerRequest(userId: string, assetId: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId, kind: "IMAGE", status: "READY" }
    });
    if (!asset) throw new BadRequestException("BANNER_LOGO_NOT_READY");
    return prisma.bannerRequest.create({
      data: { ownerId: userId, mediaId: assetId, status: "DRAFT" }
    });
  }

  async appealReport(userId: string, reportId: string, body: unknown) {
    const { message } = parse(appealSchema, body);
    const report = await prisma.report.findFirst({
      where: { id: reportId, ad: { ownerId: userId }, status: "ACTIONED" }
    });
    if (!report) throw new NotFoundException("REPORT_NOT_APPEALABLE");
    return prisma.$transaction(async (tx) => {
      const appeal = await tx.appeal.create({ data: { reportId, ownerId: userId, message } });
      await tx.report.update({ where: { id: reportId }, data: { status: "APPEALED" } });
      return appeal;
    });
  }

  async toggleFavorite(userId: string, adId: string, save: boolean) {
    if (save) {
      await prisma.favorite.upsert({
        where: { userId_adId: { userId, adId } },
        update: {},
        create: { userId, adId }
      });
    } else {
      await prisma.favorite.deleteMany({ where: { userId, adId } });
    }
    return { saved: save };
  }

  async savedAds(userId: string) {
    const favorites = await prisma.favorite.findMany({
      where: { userId, ad: { status: "ACTIVE", expiresAt: { gt: new Date() } } },
      include: { ad: { include: adInclude } },
      orderBy: { createdAt: "desc" }
    });
    return favorites.map((favorite) => presentAd(favorite.ad));
  }

  async report(userId: string, adId: string, body: unknown) {
    const input = parse(reportSchema, body);
    return prisma.report.upsert({
      where: { reporterId_adId_reason: { reporterId: userId, adId, reason: input.reason } },
      update: { details: input.details, status: "OPEN" },
      create: { reporterId: userId, adId, reason: input.reason, details: input.details }
    });
  }
}

@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Public()
  @Get("health")
  health() {
    return { status: "ok", service: "e3lani-api" };
  }

  @Public()
  @Get("catalog")
  catalog() {
    return this.platform.catalog();
  }

  @Public()
  @Get("config")
  config() {
    return this.platform.productConfig();
  }

  @Public()
  @Get("feed")
  feed(@Query() query: unknown) {
    return this.platform.feed(query);
  }

  @Public()
  @Get("banners")
  banners() {
    return this.platform.activeBanners();
  }

  @Public()
  @Get("ads/:id")
  ad(@Param("id") id: string) {
    return this.platform.publicAd(id);
  }

  @Public()
  @Get("profiles/:id")
  profile(@Param("id") id: string) {
    return this.platform.publicProfile(id);
  }

  @Patch("me/profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.platform.updateProfile(user.id, body);
  }

  @Patch("me/avatar")
  avatar(@CurrentUser() user: AuthUser, @Body("assetId") assetId: string | null) {
    return this.platform.setAvatar(user.id, assetId);
  }

  @Patch("me/business")
  updateBusiness(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.platform.updateBusinessProfile(user.id, body);
  }

  @Patch("me/business/:field")
  businessAsset(
    @CurrentUser() user: AuthUser,
    @Param("field") field: string,
    @Body("assetId") assetId: string | null
  ) {
    if (!["logo", "cover"].includes(field)) throw new BadRequestException("ASSET_FIELD_INVALID");
    return this.platform.setBusinessAsset(user.id, field === "logo" ? "logoUrl" : "coverUrl", assetId);
  }

  @Post("ads")
  createAd(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.platform.createAd(user.id, body);
  }

  @Post("posts")
  createPost(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.platform.createPost(user.id, body);
  }

  @Patch("posts/:id")
  updatePost(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.platform.updatePost(user.id, id, body);
  }

  @Delete("posts/:id")
  deletePost(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.platform.deletePost(user.id, id);
  }

  @Post("posts/:id/save")
  savePost(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.platform.togglePostFavorite(user.id, id, true);
  }

  @Delete("posts/:id/save")
  unsavePost(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.platform.togglePostFavorite(user.id, id, false);
  }

  @Get("me/ads")
  myAds(@CurrentUser() user: AuthUser) {
    return this.platform.myAds(user.id);
  }

  @Post("ads/:id/status")
  adStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body("action") action: "PAUSE" | "RESUME" | "REMOVE"
  ) {
    if (!["PAUSE", "RESUME", "REMOVE"].includes(action)) {
      throw new BadRequestException("AD_ACTION_INVALID");
    }
    return this.platform.changeAdStatus(user.id, id, action);
  }

  @Post("banner-requests")
  bannerRequest(@CurrentUser() user: AuthUser, @Body("assetId") assetId: string) {
    return this.platform.createBannerRequest(user.id, assetId);
  }

  @Post("reports/:id/appeals")
  appeal(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.platform.appealReport(user.id, id, body);
  }

  @Post("ads/:id/save")
  save(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.platform.toggleFavorite(user.id, id, true);
  }

  @Get("saved")
  saved(@CurrentUser() user: AuthUser) {
    return this.platform.savedAds(user.id);
  }

  @Delete("ads/:id/save")
  unsave(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.platform.toggleFavorite(user.id, id, false);
  }

  @Post("ads/:id/reports")
  report(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.platform.report(user.id, id, body);
  }
}
