import { Controller, Get, Injectable } from "@nestjs/common";

import { PrismaService, Public } from "../common";

function publicMediaUrl(key: string | null) {
  return key ? `${process.env.S3_PUBLIC_URL}/${key}` : null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog() {
    const [regions, categories] = await Promise.all([
      this.prisma.region.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { cities: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
      }),
      this.prisma.category.findMany({
        where: { active: true, parentId: null },
        orderBy: { sortOrder: "asc" },
        include: { children: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
      }),
    ]);
    return { regions, categories };
  }

  async getPublicConfig() {
    const [settings, pricing] = await Promise.all([
      this.prisma.appSetting.findMany({ where: { public: true } }),
      this.prisma.pricingVersion.findFirst({
        where: { active: true, effectiveFrom: { lte: new Date() } },
        orderBy: { version: "desc" },
        include: { rules: { where: { active: true } } },
      }),
    ]);
    const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
    return {
      launchMode: values["platform.mode"] ?? "FREE_LAUNCH",
      paymentsEnabled: values["payments.enabled"] === true,
      defaultDurationDays: values["ads.defaultDurationDays"] ?? 30,
      pricing: values["payments.enabled"] === true ? pricing : null,
    };
  }

  async getTicker() {
    const rows = await this.prisma.tickerRequest.findMany({
      where: {
        status: "ACTIVE",
        startsAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        logoMedia: { status: "READY" },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { logoMedia: true },
    });
    return rows.map((row) => ({
      id: row.id,
      logoUrl: publicMediaUrl(row.logoMedia.optimizedKey ?? row.logoMedia.sourceKey),
    }));
  }
}

@Public()
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.getCatalog();
  }

  @Get("config")
  config() {
    return this.catalog.getPublicConfig();
  }

  @Get("ticker")
  ticker() {
    return this.catalog.getTicker();
  }
}
