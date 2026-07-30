import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  createDistributionSchema,
  createPostSchema,
  feedQuerySchema,
  reportSchema,
} from "@e3lani/types";

import { CurrentUser, type AuthUser, parseInput, PrismaService, Public } from "../common";

const eventSchema = z.object({
  distributionId: z.string().cuid(),
  type: z.enum([
    "IMPRESSION",
    "VIEW",
    "VIDEO_START",
    "VIDEO_COMPLETE",
    "WHATSAPP_CLICK",
    "STORE_CLICK",
    "PHONE_CLICK",
    "SHARE",
  ]),
  anonymousId: z.string().min(16).max(100),
  watchMs: z.number().int().min(0).max(60_000).optional(),
  source: z.enum(["ORGANIC", "PAID"]).default("ORGANIC"),
  bucket: z.string().datetime().optional(),
});

function mediaUrl(key: string | null) {
  return key ? `${process.env.S3_PUBLIC_URL}/${key}` : null;
}

function moderationFor(text: string) {
  const prohibited = ["مخدر", "سلاح غير مرخص", "تزوير", "احتيال مالي"];
  return prohibited.some((term) => text.includes(term)) ? "BLOCKED" : "SAFE";
}

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async feed(rawQuery: unknown) {
    const query = parseInput(feedQuerySchema, rawQuery);
    if (query.mode === "NEARBY" && !query.cityId) {
      throw new BadRequestException("CITY_REQUIRED_FOR_NEARBY");
    }
    const distributions = await this.prisma.adDistribution.findMany({
      where: {
        status: "ACTIVE",
        startsAt: { lte: new Date() },
        expiresAt: { gt: new Date() },
        ...(query.cityId
          ? {
              OR: [
                { scope: "NATIONWIDE" },
                { primaryCityId: query.cityId },
                { targetCities: { some: { cityId: query.cityId } } },
              ],
            }
          : {}),
        ...(query.featured ? { featuredUntil: { gt: new Date() } } : {}),
        ...(query.sponsored !== undefined ? { sponsored: query.sponsored } : {}),
        post: {
          status: "PUBLISHED",
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
          ...(query.search
            ? {
                OR: [
                  { title: { contains: query.search, mode: "insensitive" } },
                  { description: { contains: query.search, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(query.media
            ? { media: { some: { mediaAsset: { kind: query.media, status: "READY" } } } }
            : {}),
          ...(query.verified
            ? { owner: { profile: { is: { verifiedAt: { not: null } } } } }
            : {}),
        },
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy:
        query.mode === "LATEST"
          ? [{ createdAt: "desc" }, { id: "desc" }]
          : [{ sponsored: "desc" }, { featuredUntil: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      include: {
        primaryCity: true,
        owner: { include: { profile: { include: { avatarMedia: true } } } },
        post: {
          include: {
            city: true,
            media: {
              orderBy: { position: "asc" },
              include: { mediaAsset: true },
            },
          },
        },
      },
    });
    const hasMore = distributions.length > query.limit;
    const page = hasMore ? distributions.slice(0, query.limit) : distributions;
    return {
      items: page.map((distribution) => ({
        id: distribution.id,
        postId: distribution.postId,
        title: distribution.post.title,
        description: distribution.post.description,
        advertiser: {
          id: distribution.ownerId,
          slug: distribution.owner.profile?.slug ?? distribution.ownerId,
          name: distribution.owner.profile?.name ?? "",
          avatarUrl: mediaUrl(
            distribution.owner.profile?.avatarMedia?.optimizedKey ??
              distribution.owner.profile?.avatarMedia?.sourceKey ??
              null,
          ),
          verified: Boolean(distribution.owner.profile?.verifiedAt),
        },
        city: {
          id: distribution.post.city.id,
          nameAr: distribution.post.city.nameAr,
          nameEn: distribution.post.city.nameEn,
        },
        media: distribution.post.media.map(({ mediaAsset }) => ({
          id: mediaAsset.id,
          kind: mediaAsset.kind,
          url: mediaUrl(mediaAsset.optimizedKey ?? mediaAsset.sourceKey),
          thumbnailUrl: mediaUrl(mediaAsset.thumbnailKey),
          width: mediaAsset.width,
          height: mediaAsset.height,
          durationSeconds: mediaAsset.durationSeconds,
        })),
        contact: { type: distribution.contactType, value: distribution.contactValue },
        featured: Boolean(distribution.featuredUntil && distribution.featuredUntil > new Date()),
        sponsored: distribution.sponsored,
        saved: false,
        createdAt: distribution.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page.at(-1)?.id : null,
    };
  }

  async createPost(user: AuthUser, rawInput: unknown) {
    const input = parseInput(createPostSchema, rawInput);
    const [category, city, media] = await Promise.all([
      this.prisma.category.findFirst({ where: { id: input.categoryId, active: true } }),
      this.prisma.city.findFirst({ where: { id: input.cityId, active: true } }),
      this.prisma.mediaAsset.findMany({
        where: { id: { in: input.mediaIds }, ownerId: user.id, status: "READY", purpose: "POST" },
      }),
    ]);
    if (!category || !city) throw new BadRequestException("INVALID_CATEGORY_OR_CITY");
    if (media.length !== input.mediaIds.length) throw new BadRequestException("MEDIA_NOT_READY_OR_OWNED");
    const kinds = new Set(media.map((item) => item.kind));
    if (kinds.size > 1 || (kinds.has("VIDEO") && media.length !== 1)) {
      throw new BadRequestException("USE_ONE_VIDEO_OR_ONE_TO_FIVE_IMAGES");
    }
    const moderation = moderationFor(`${input.title} ${input.description ?? ""}`);
    if (moderation === "BLOCKED") throw new BadRequestException("PROHIBITED_CONTENT");
    return this.prisma.$transaction(async (transaction) => {
      const post = await transaction.profilePost.create({
        data: {
          ownerId: user.id,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
          cityId: input.cityId,
          title: input.title,
          description: input.description,
          contactType: input.contact.type,
          contactValue: input.contact.value,
          status: input.publish ? "PUBLISHED" : "DRAFT",
          publishedAt: input.publish ? new Date() : null,
          media: {
            create: input.mediaIds.map((mediaAssetId, position) => ({ mediaAssetId, position })),
          },
        },
        include: { media: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: input.publish ? "POST_PUBLISHED" : "POST_DRAFT_CREATED",
          entityType: "ProfilePost",
          entityId: post.id,
          after: { title: post.title, status: post.status },
        },
      });
      return post;
    });
  }

  async distribution(id: string) {
    const distribution = await this.prisma.adDistribution.findFirst({
      where: { id, status: "ACTIVE", expiresAt: { gt: new Date() }, post: { status: "PUBLISHED" } },
      include: {
        owner: { include: { profile: { include: { avatarMedia: true } } } },
        post: {
          include: {
            city: true,
            category: true,
            subcategory: true,
            media: { orderBy: { position: "asc" }, include: { mediaAsset: true } },
          },
        },
        _count: { select: { events: { where: { type: "VIEW" } }, favorites: true } },
      },
    });
    if (!distribution) throw new NotFoundException("DISTRIBUTION_NOT_FOUND");
    return {
      id: distribution.id,
      postId: distribution.postId,
      title: distribution.post.title,
      description: distribution.post.description,
      advertiser: {
        id: distribution.ownerId,
        slug: distribution.owner.profile?.slug ?? distribution.ownerId,
        name: distribution.owner.profile?.name ?? "",
        avatarUrl: mediaUrl(
          distribution.owner.profile?.avatarMedia?.optimizedKey ??
            distribution.owner.profile?.avatarMedia?.sourceKey ??
            null,
        ),
        verified: Boolean(distribution.owner.profile?.verifiedAt),
      },
      city: {
        id: distribution.post.city.id,
        nameAr: distribution.post.city.nameAr,
        nameEn: distribution.post.city.nameEn,
      },
      category: {
        id: distribution.post.category.id,
        nameAr: distribution.post.category.nameAr,
        nameEn: distribution.post.category.nameEn,
      },
      media: distribution.post.media.map(({ mediaAsset }) => ({
        id: mediaAsset.id,
        kind: mediaAsset.kind,
        url: mediaUrl(mediaAsset.optimizedKey ?? mediaAsset.sourceKey),
        thumbnailUrl: mediaUrl(mediaAsset.thumbnailKey),
        width: mediaAsset.width,
        height: mediaAsset.height,
        durationSeconds: mediaAsset.durationSeconds,
      })),
      contact: { type: distribution.contactType, value: distribution.contactValue },
      featured: Boolean(distribution.featuredUntil && distribution.featuredUntil > new Date()),
      sponsored: distribution.sponsored,
      saved: false,
      viewCount: distribution._count.events,
      saveCount: distribution._count.favorites,
      createdAt: distribution.createdAt.toISOString(),
    };
  }

  async distribute(user: AuthUser, rawInput: unknown) {
    const input = parseInput(createDistributionSchema, rawInput);
    const [post, modeSetting, paymentSetting, durationSetting, pricing] = await Promise.all([
      this.prisma.profilePost.findFirst({
        where: { id: input.postId, ownerId: user.id, status: "PUBLISHED" },
      }),
      this.prisma.appSetting.findUnique({ where: { key: "platform.mode" } }),
      this.prisma.appSetting.findUnique({ where: { key: "payments.enabled" } }),
      this.prisma.appSetting.findUnique({ where: { key: "ads.defaultDurationDays" } }),
      this.prisma.pricingVersion.findFirst({
        where: { active: true, effectiveFrom: { lte: new Date() } },
        include: { rules: { where: { active: true } } },
      }),
    ]);
    if (!post) throw new NotFoundException("PUBLISHED_POST_NOT_FOUND");
    const mode = String(modeSetting?.value ?? "FREE_LAUNCH");
    if (mode === "PROFILE_ONLY") throw new BadRequestException("DISTRIBUTION_DISABLED");
    const paymentsEnabled = paymentSetting?.value === true;
    if (mode === "PAID_ONLY" && !paymentsEnabled) {
      throw new BadRequestException("PAYMENT_PROVIDER_NOT_ENABLED");
    }
    const selectedRules = pricing?.rules.filter(
      (rule) => rule.code === "standard_ad" || input.promotionCodes.includes(rule.code),
    ) ?? [];
    const total = selectedRules.reduce((sum, rule) => sum + rule.priceHalalas, 0);
    const now = new Date();
    const durationDays = Number(durationSetting?.value ?? 30);
    const active = mode === "FREE_LAUNCH";
    return this.prisma.$transaction(async (transaction) => {
      const distribution = await transaction.adDistribution.create({
        data: {
          postId: post.id,
          ownerId: user.id,
          primaryCityId: input.scope === "CITY" ? input.cityIds[0] ?? post.cityId : null,
          scope: input.scope,
          contactType: input.contact.type,
          contactValue: input.contact.value,
          status: active ? "ACTIVE" : "PENDING_PAYMENT",
          moderationResult: "SAFE",
          startsAt: active ? now : null,
          expiresAt: active ? new Date(now.getTime() + durationDays * 86_400_000) : null,
          priceSnapshotHalalas: active ? 0 : total,
          pricingVersionId: pricing?.id,
          targetCities: {
            create: input.cityIds.map((cityId) => ({ cityId })),
          },
          promotions: {
            create: selectedRules
              .filter((rule) => rule.code !== "standard_ad")
              .map((rule) => ({ pricingRuleId: rule.id, priceHalalas: rule.priceHalalas })),
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: active ? "DISTRIBUTION_ACTIVATED_FREE_LAUNCH" : "DISTRIBUTION_AWAITING_PAYMENT",
          entityType: "AdDistribution",
          entityId: distribution.id,
          after: { status: distribution.status, priceSnapshotHalalas: distribution.priceSnapshotHalalas },
        },
      });
      return distribution;
    });
  }

  async publicProfile(slug: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { slug },
      include: {
        city: true,
        avatarMedia: true,
        coverMedia: true,
        user: {
          include: {
            posts: {
              where: { status: "PUBLISHED" },
              orderBy: { publishedAt: "desc" },
              include: {
                media: { orderBy: { position: "asc" }, include: { mediaAsset: true } },
                distributions: { where: { status: "ACTIVE", expiresAt: { gt: new Date() } } },
              },
            },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException("PROFILE_NOT_FOUND");
    const mapPost = (post: (typeof profile.user.posts)[number]) => ({
      id: post.id,
      title: post.title,
      description: post.description,
      publishedAt: post.publishedAt,
      media: post.media.map(({ mediaAsset }) => ({
        id: mediaAsset.id,
        kind: mediaAsset.kind,
        url: mediaUrl(mediaAsset.optimizedKey ?? mediaAsset.sourceKey),
        thumbnailUrl: mediaUrl(mediaAsset.thumbnailKey),
      })),
    });
    return {
      id: profile.userId,
      slug: profile.slug,
      name: profile.name,
      bio: profile.bio,
      city: profile.city,
      verified: Boolean(profile.verifiedAt),
      avatarUrl: mediaUrl(profile.avatarMedia?.optimizedKey ?? profile.avatarMedia?.sourceKey ?? null),
      coverUrl: mediaUrl(profile.coverMedia?.optimizedKey ?? profile.coverMedia?.sourceKey ?? null),
      links: {
        website: profile.websiteUrl,
        whatsapp: profile.whatsapp,
        phone: profile.phone,
        instagram: profile.instagramUrl,
        x: profile.xUrl,
      },
      posts: profile.user.posts.map(mapPost),
      ads: profile.user.posts
        .filter((post) => post.distributions.length > 0)
        .map(mapPost),
    };
  }

  async save(user: AuthUser, distributionId: string) {
    await this.prisma.favorite.upsert({
      where: { userId_distributionId: { userId: user.id, distributionId } },
      update: {},
      create: { userId: user.id, distributionId },
    });
    return { saved: true };
  }

  async unsave(user: AuthUser, distributionId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId: user.id, distributionId } });
    return { saved: false };
  }

  saved(user: AuthUser) {
    return this.prisma.favorite.findMany({
      where: { userId: user.id, distribution: { status: "ACTIVE", expiresAt: { gt: new Date() } } },
      orderBy: { createdAt: "desc" },
      include: {
        distribution: {
          include: {
            post: {
              include: {
                city: true,
                media: { orderBy: { position: "asc" }, include: { mediaAsset: true } },
              },
            },
          },
        },
      },
    });
  }

  report(user: AuthUser, rawInput: unknown) {
    const input = parseInput(reportSchema, rawInput);
    return this.prisma.report.create({
      data: {
        reporterId: user.id,
        distributionId: input.distributionId,
        reason: input.reason,
        details: input.details,
      },
    });
  }

  async event(rawInput: unknown) {
    const input = parseInput(eventSchema, rawInput);
    const bucket = input.bucket ?? new Date(Math.floor(Date.now() / 30_000) * 30_000).toISOString();
    const dedupeKey = createHash("sha256")
      .update(`${input.distributionId}:${input.type}:${input.anonymousId}:${bucket}`)
      .digest("hex");
    await this.prisma.adEvent.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        distributionId: input.distributionId,
        type: input.type,
        anonymousId: input.anonymousId,
        source: input.source,
        watchMs: input.watchMs,
        dedupeKey,
      },
    });
    return { accepted: true };
  }
}

@Controller("content")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get("feed")
  feed(@Query() query: unknown) {
    return this.content.feed(query);
  }

  @Public()
  @Get("profiles/:slug")
  profile(@Param("slug") slug: string) {
    return this.content.publicProfile(slug);
  }

  @Public()
  @Get("distributions/:id")
  distribution(@Param("id") id: string) {
    return this.content.distribution(id);
  }

  @Post("posts")
  createPost(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.content.createPost(user, body);
  }

  @Post("distributions")
  distribute(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.content.distribute(user, body);
  }

  @Get("saved")
  saved(@CurrentUser() user: AuthUser) {
    return this.content.saved(user);
  }

  @Post("saved/:id")
  save(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.content.save(user, id);
  }

  @Delete("saved/:id")
  unsave(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.content.unsave(user, id);
  }

  @Post("reports")
  report(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.content.report(user, body);
  }

  @Public()
  @Post("events")
  event(@Body() body: unknown) {
    return this.content.event(body);
  }
}
