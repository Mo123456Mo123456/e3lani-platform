import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";

import { prisma, type Prisma } from "@e3lani/database";
import {
  analyticsEventSchema,
  createAdSchema,
  createAppealSchema,
  createPostSchema,
  createReportSchema,
  feedQuerySchema,
  updateAdSchema,
} from "@e3lani/types";

import { CurrentUser, JwtAuthGuard, type AuthUser } from "./auth.js";

const adInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      businessProfile: { select: { slug: true, logoUrl: true, verified: true } },
    },
  },
  city: true,
  category: true,
  subcategory: true,
  media: { orderBy: { sortOrder: "asc" as const }, include: { mediaAsset: true } },
  contacts: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.AdInclude;

export function validateContact(type: string, value: string) {
  if (type === "PHONE" && !/^\+?[0-9]{8,15}$/.test(value)) {
    throw new BadRequestException("PHONE_INVALID");
  }
  if (type === "WHATSAPP" && !/^(?:https:\/\/wa\.me\/|\+?[0-9]{8,15}$)/i.test(value)) {
    throw new BadRequestException("WHATSAPP_INVALID");
  }
  if (["STORE", "PRODUCT", "EXTERNAL"].includes(type)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException("CONTACT_URL_INVALID");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new BadRequestException("CONTACT_URL_PROTOCOL_NOT_ALLOWED");
    }
  }
}

async function assertUsableMedia(ownerId: string, mediaIds: string[]) {
  const media = await prisma.mediaAsset.findMany({
    where: { id: { in: mediaIds }, ownerId, status: "READY" },
  });
  if (media.length !== mediaIds.length) throw new BadRequestException("MEDIA_NOT_READY_OR_NOT_OWNED");
  const kinds = new Set(media.map((item) => item.kind));
  if (kinds.size > 1) throw new BadRequestException("MIXED_MEDIA_NOT_ALLOWED");
  if (media[0]?.kind === "VIDEO" && media.length !== 1) {
    throw new BadRequestException("ONE_VIDEO_ONLY");
  }
  return media;
}

@Controller("catalog")
export class CatalogController {
  @Get()
  async catalog() {
    const [regions, categories] = await Promise.all([
      prisma.region.findMany({
        orderBy: { nameAr: "asc" },
        include: { cities: { where: { active: true }, orderBy: { nameAr: "asc" } } },
      }),
      prisma.category.findMany({
        where: { parentId: null, active: true },
        orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
        include: {
          children: {
            where: { active: true },
            orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
          },
        },
      }),
    ]);
    return { regions, categories };
  }

  @Get("prices")
  prices() {
    return prisma.pricingItem.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
      select: {
        code: true,
        nameAr: true,
        nameEn: true,
        priceHalalas: true,
        durationDays: true,
      },
    });
  }
}

@Controller("ads")
export class AdsController {
  @Get()
  async feed(@Query() rawQuery: Record<string, string | undefined>) {
    const query = feedQuerySchema.parse(rawQuery);
    const where: Prisma.AdWhereInput = {
      status: "ACTIVE",
      publishedAt: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(query.cityId && { cityId: query.cityId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.subcategoryId && { subcategoryId: query.subcategoryId }),
      ...(query.featuredOnly && { featuredUntil: { gt: new Date() } }),
      ...(query.sponsoredOnly && { sponsoredUntil: { gt: new Date() } }),
      ...(query.verifiedOnly && { owner: { businessProfile: { verified: true } } }),
      ...(query.mediaKind && { media: { some: { mediaAsset: { kind: query.mediaKind } } } }),
    };
    const ads = await prisma.ad.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy:
        query.mode === "LATEST"
          ? [{ publishedAt: "desc" }]
          : [{ sponsoredUntil: "desc" }, { featuredUntil: "desc" }, { publishedAt: "desc" }],
      include: adInclude,
    });
    const nextCursor = ads.length > query.limit ? ads.pop()?.id : undefined;
    return { items: ads, nextCursor };
  }

  @Get("search")
  async search(
    @Query("q") q = "",
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const query = feedQuerySchema.parse(rawQuery);
    return prisma.ad.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
        ...(query.cityId && { cityId: query.cityId }),
        ...(query.categoryId && { categoryId: query.categoryId }),
      },
      take: query.limit,
      orderBy: { publishedAt: "desc" },
      include: adInclude,
    });
  }

  @Get(":id")
  async one(@Param("id") id: string) {
    const ad = await prisma.ad.findFirst({
      where: {
        id,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: adInclude,
    });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    return ad;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = createAdSchema.parse(body);
    input.contacts.forEach((contact) => validateContact(contact.type, contact.value));
    await assertUsableMedia(user.id, input.mediaIds);

    const [modeSetting, paymentSetting, standardPrice] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: "platform.mode" } }),
      prisma.appSetting.findUnique({ where: { key: "payments.enabled" } }),
      prisma.pricingItem.findUnique({ where: { code: "STANDARD_AD" } }),
    ]);
    const mode = modeSetting?.value === "PAID_ONLY" ? "PAID_ONLY" : "FREE_LAUNCH";
    if (mode === "PAID_ONLY" && paymentSetting?.value !== true) {
      throw new ServiceUnavailableException("PAYMENTS_NOT_CONFIGURED");
    }
    const publishedAt = mode === "FREE_LAUNCH" ? new Date() : null;
    const durationDays = standardPrice?.durationDays ?? 30;

    return prisma.ad.create({
      data: {
        ownerId: user.id,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        cityId: input.cityId,
        audienceScope: input.audienceScope,
        status: mode === "FREE_LAUNCH" ? "ACTIVE" : "AWAITING_PAYMENT",
        publishedAt,
        expiresAt: publishedAt
          ? new Date(publishedAt.getTime() + durationDays * 86_400_000)
          : null,
        media: {
          create: input.mediaIds.map((mediaAssetId, sortOrder) => ({
            mediaAssetId,
            sortOrder,
          })),
        },
        contacts: {
          create: input.contacts.map((contact, sortOrder) => ({ ...contact, sortOrder })),
        },
      },
      include: adInclude,
    });
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = updateAdSchema.parse(body);
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    if (ad.ownerId !== user.id) throw new ForbiddenException("NOT_AD_OWNER");
    if (input.contacts) input.contacts.forEach((contact) => validateContact(contact.type, contact.value));
    if (input.mediaIds) await assertUsableMedia(user.id, input.mediaIds);

    return prisma.$transaction(async (tx) => {
      if (input.mediaIds) {
        await tx.adMedia.deleteMany({ where: { adId: id } });
        await tx.adMedia.createMany({
          data: input.mediaIds.map((mediaAssetId, sortOrder) => ({ adId: id, mediaAssetId, sortOrder })),
        });
      }
      if (input.contacts) {
        await tx.adContact.deleteMany({ where: { adId: id } });
        await tx.adContact.createMany({
          data: input.contacts.map((contact, sortOrder) => ({ adId: id, ...contact, sortOrder })),
        });
      }
      return tx.ad.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
          cityId: input.cityId,
          audienceScope: input.audienceScope,
        },
        include: adInclude,
      });
    });
  }

  @Post(":id/save")
  @UseGuards(JwtAuthGuard)
  async save(@CurrentUser() user: AuthUser, @Param("id") adId: string) {
    await prisma.favoriteAd.upsert({
      where: { userId_adId: { userId: user.id, adId } },
      update: {},
      create: { userId: user.id, adId },
    });
    return { saved: true };
  }

  @Delete(":id/save")
  @UseGuards(JwtAuthGuard)
  async unsave(@CurrentUser() user: AuthUser, @Param("id") adId: string) {
    await prisma.favoriteAd.deleteMany({ where: { userId: user.id, adId } });
    return { saved: false };
  }

  @Post(":id/report")
  @UseGuards(JwtAuthGuard)
  async report(
    @CurrentUser() user: AuthUser,
    @Param("id") adId: string,
    @Body() body: unknown,
  ) {
    const input = createReportSchema.parse(body);
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    if (ad.ownerId === user.id) throw new BadRequestException("CANNOT_REPORT_OWN_AD");
    return prisma.report.create({ data: { adId, reporterId: user.id, ...input } });
  }

  @Post(":id/appeals")
  @UseGuards(JwtAuthGuard)
  async appeal(
    @CurrentUser() user: AuthUser,
    @Param("id") adId: string,
    @Body() body: unknown,
  ) {
    const input = createAppealSchema.parse(body);
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    if (ad.ownerId !== user.id || ad.status !== "SUSPENDED") {
      throw new BadRequestException("APPEAL_NOT_ALLOWED");
    }
    return prisma.appeal.create({ data: { adId, appellantId: user.id, message: input.message } });
  }
}

@Controller("posts")
@UseGuards(JwtAuthGuard)
export class PostsController {
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = createPostSchema.parse(body);
    await assertUsableMedia(user.id, input.mediaIds);
    return prisma.profilePost.create({
      data: {
        ownerId: user.id,
        caption: input.caption,
        media: {
          create: input.mediaIds.map((mediaAssetId, sortOrder) => ({ mediaAssetId, sortOrder })),
        },
      },
      include: { media: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } } },
    });
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = createPostSchema.partial().parse(body);
    const post = await prisma.profilePost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("POST_NOT_FOUND");
    if (post.ownerId !== user.id) throw new ForbiddenException("NOT_POST_OWNER");
    if (input.mediaIds) await assertUsableMedia(user.id, input.mediaIds);
    return prisma.$transaction(async (tx) => {
      if (input.mediaIds) {
        await tx.postMedia.deleteMany({ where: { postId: id } });
        await tx.postMedia.createMany({
          data: input.mediaIds.map((mediaAssetId, sortOrder) => ({ postId: id, mediaAssetId, sortOrder })),
        });
      }
      return tx.profilePost.update({
        where: { id },
        data: { caption: input.caption },
        include: { media: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } } },
      });
    });
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const removed = await prisma.profilePost.deleteMany({ where: { id, ownerId: user.id } });
    if (!removed.count) throw new NotFoundException("POST_NOT_FOUND");
    return { deleted: true };
  }

  @Post(":id/save")
  async save(@CurrentUser() user: AuthUser, @Param("id") postId: string) {
    await prisma.savedPost.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      update: {},
      create: { userId: user.id, postId },
    });
    return { saved: true };
  }
}

@Controller("profiles")
export class ProfilesController {
  @Get(":slug")
  async get(@Param("slug") slug: string) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: slug }, { businessProfile: { slug } }], status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        city: true,
        businessProfile: true,
        ads: {
          where: { status: "ACTIVE" },
          orderBy: { publishedAt: "desc" },
          include: adInclude,
        },
        posts: {
          where: { published: true },
          orderBy: { createdAt: "desc" },
          include: { media: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!user) throw new NotFoundException("PROFILE_NOT_FOUND");
    const views = await prisma.analyticsEvent.count({
      where: { ad: { ownerId: user.id }, event: "IMPRESSION" },
    });
    return { ...user, views };
  }

  @Patch("me/business")
  @UseGuards(JwtAuthGuard)
  async updateBusiness(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      slug?: string;
      bio?: string;
      websiteUrl?: string;
      whatsapp?: string;
      instagramUrl?: string;
      xUrl?: string;
    },
  ) {
    if (user.accountType === "INDIVIDUAL") {
      throw new BadRequestException("BUSINESS_ACCOUNT_REQUIRED");
    }
    if (!body.slug || !/^[a-z0-9-]{3,100}$/.test(body.slug)) {
      throw new BadRequestException("BUSINESS_SLUG_INVALID");
    }
    for (const value of [body.websiteUrl, body.instagramUrl, body.xUrl].filter(Boolean)) {
      validateContact("EXTERNAL", value!);
    }
    return prisma.businessProfile.upsert({
      where: { userId: user.id },
      update: body,
      create: { userId: user.id, ...body, slug: body.slug },
    });
  }
}

@Controller("saved")
@UseGuards(JwtAuthGuard)
export class SavedController {
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const [ads, posts] = await Promise.all([
      prisma.favoriteAd.findMany({
        where: { userId: user.id, ad: { status: "ACTIVE" } },
        orderBy: { createdAt: "desc" },
        include: { ad: { include: adInclude } },
      }),
      prisma.savedPost.findMany({
        where: { userId: user.id, post: { published: true } },
        orderBy: { createdAt: "desc" },
        include: {
          post: {
            include: { media: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      }),
    ]);
    return { ads: ads.map((item) => item.ad), posts: posts.map((item) => item.post) };
  }
}

@Controller("banners")
export class BannersController {
  @Get()
  async active() {
    const now = new Date();
    return prisma.bannerPlacement.findMany({
      where: {
        status: "ACTIVE",
        startsAt: { lte: now },
        endsAt: { gt: now },
        logoMedia: { status: "READY" },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        logoMedia: { select: { thumbnailUrl: true, variants: true } },
        owner: { select: { name: true } },
      },
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async request(@CurrentUser() user: AuthUser, @Body() body: { logoMediaId?: string }) {
    if (!body.logoMediaId) throw new BadRequestException("LOGO_MEDIA_REQUIRED");
    const logo = await prisma.mediaAsset.findFirst({
      where: {
        id: body.logoMediaId,
        ownerId: user.id,
        kind: "IMAGE",
        status: "READY",
      },
    });
    if (!logo) throw new BadRequestException("LOGO_MEDIA_NOT_READY");
    return prisma.bannerPlacement.create({
      data: {
        ownerId: user.id,
        logoMediaId: logo.id,
        status: "DRAFT",
      },
    });
  }
}

@Controller("analytics")
export class AnalyticsController {
  @Post("events")
  async event(@Body() body: unknown) {
    const input = analyticsEventSchema.parse(body);
    const ad = await prisma.ad.findFirst({ where: { id: input.adId, status: "ACTIVE" } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    await prisma.analyticsEvent.create({
      data: {
        adId: input.adId,
        event: input.event,
        watchDurationMs: input.watchDurationMs,
        cityId: input.cityId,
        source: input.source,
        dedupeKey: input.dedupeKey,
      },
    });
    return { accepted: true };
  }

  @Get("ads/:id")
  @UseGuards(JwtAuthGuard)
  async summary(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException("AD_NOT_FOUND");
    if (ad.ownerId !== user.id && user.staffRole === "USER") {
      throw new ForbiddenException("ANALYTICS_NOT_ALLOWED");
    }
    const grouped = await prisma.analyticsEvent.groupBy({
      by: ["event", "source"],
      where: { adId: id },
      _count: { _all: true },
      _avg: { watchDurationMs: true },
    });
    return { adId: id, totals: grouped };
  }
}

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Patch(":id/read")
  async read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    return { read: true };
  }
}
