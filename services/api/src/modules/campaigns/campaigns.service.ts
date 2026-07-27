import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateCampaignInput, UpdateCampaignInput } from '@e3lani/validation';
import { CampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

type CampaignTargeting = {
  cityIds?: string[];
  categoryIds?: string[];
};

type CampaignTransitionInput = {
  status: CampaignStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  budgetTotal?: Prisma.Decimal | number | string;
  adCount?: number;
};

const IMPRESSION_EVENTS = ['ad.impression', 'impression', 'ad.view', 'view'];
const CLICK_EVENTS = ['ad.click', 'click', 'contact.click', 'store.click', 'whatsapp.click', 'phone.click'];
const SAVE_EVENTS = ['ad.save', 'save'];
const REPORT_EVENTS = [...IMPRESSION_EVENTS, ...CLICK_EVENTS, ...SAVE_EVENTS];

export function assertCampaignCanPause(campaign: CampaignTransitionInput): void {
  if (campaign.status !== 'ACTIVE') throw new BadRequestException('CAMPAIGN_NOT_ACTIVE');
}

export function assertCampaignCanResume(
  campaign: CampaignTransitionInput,
  now = new Date(),
): void {
  if (campaign.status !== 'PAUSED') throw new BadRequestException('CAMPAIGN_NOT_PAUSED');
  assertCampaignScheduleActive(campaign, now);
}

export function assertCampaignCanActivate(
  campaign: CampaignTransitionInput,
  now = new Date(),
): void {
  if (!['DRAFT', 'PENDING_REVIEW'].includes(campaign.status)) {
    throw new BadRequestException('CAMPAIGN_NOT_ACTIVATABLE');
  }
  if (Number(campaign.budgetTotal ?? 0) <= 0) {
    throw new BadRequestException('CAMPAIGN_BUDGET_REQUIRED');
  }
  if ((campaign.adCount ?? 0) <= 0) {
    throw new BadRequestException('CAMPAIGN_AD_REQUIRED');
  }
  assertCampaignScheduleActive(campaign, now);
}

function assertCampaignScheduleActive(campaign: CampaignTransitionInput, now = new Date()) {
  if (campaign.startsAt && campaign.startsAt > now) {
    throw new BadRequestException('CAMPAIGN_NOT_STARTED');
  }
  if (campaign.endsAt && campaign.endsAt <= now) {
    throw new BadRequestException('CAMPAIGN_ENDED');
  }
}

function assertValidDateRange(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new BadRequestException('CAMPAIGN_DATE_RANGE_INVALID');
  }
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(ownerId: string, input: CreateCampaignInput) {
    if (input.adIds?.length) {
      await this.ensureOwnsAds(ownerId, input.adIds);
    }
    await this.ensureTargetingExists(input.targeting);

    const campaign = await this.prisma.campaign.create({
      data: {
        ownerId,
        name: input.name,
        objective: input.objective,
        budgetTotal: input.budgetTotal,
        currency: input.currency,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        targeting: input.targeting as Prisma.InputJsonValue | undefined,
        notes: input.notes,
        ads: input.adIds?.length
          ? { create: input.adIds.map((adId, sortOrder) => ({ adId, sortOrder })) }
          : undefined,
      },
      include: { ads: true },
    });

    await this.audit.write({
      actorId: ownerId,
      action: 'campaigns.create',
      entityType: 'campaign',
      entityId: campaign.id,
      after: { name: campaign.name, budgetTotal: String(campaign.budgetTotal) },
    });

    return campaign;
  }

  mine(ownerId: string) {
    return this.prisma.campaign.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: { ads: { include: { ad: { select: { id: true, status: true } } } } },
    });
  }

  async get(id: string, ownerId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { ads: { include: { ad: { select: { id: true, status: true } } } } },
    });
    if (!campaign) throw new NotFoundException('CAMPAIGN_NOT_FOUND');
    if (campaign.ownerId !== ownerId) throw new ForbiddenException();
    return campaign;
  }

  async update(id: string, ownerId: string, patch: UpdateCampaignInput) {
    const before = await this.get(id, ownerId);
    await this.ensureTargetingExists(patch.targeting);
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : before.startsAt;
    const endsAt = patch.endsAt ? new Date(patch.endsAt) : before.endsAt;
    assertValidDateRange(startsAt, endsAt);

    const data: Prisma.CampaignUpdateInput = {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.objective !== undefined ? { objective: patch.objective } : {}),
      ...(patch.budgetTotal !== undefined ? { budgetTotal: patch.budgetTotal } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.startsAt !== undefined ? { startsAt } : {}),
      ...(patch.endsAt !== undefined ? { endsAt } : {}),
      ...(patch.targeting !== undefined
        ? { targeting: patch.targeting as Prisma.InputJsonValue }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    };

    const updated = await this.prisma.campaign.update({
      where: { id },
      data,
      include: { ads: { include: { ad: { select: { id: true, status: true } } } } },
    });

    await this.audit.write({
      actorId: ownerId,
      action: 'campaigns.update',
      entityType: 'campaign',
      entityId: id,
      before: {
        name: before.name,
        status: before.status,
        startsAt: before.startsAt?.toISOString() ?? null,
        endsAt: before.endsAt?.toISOString() ?? null,
      },
      after: {
        name: updated.name,
        status: updated.status,
        startsAt: updated.startsAt?.toISOString() ?? null,
        endsAt: updated.endsAt?.toISOString() ?? null,
      },
    });

    return updated;
  }

  async addAds(id: string, ownerId: string, adIds: string[]) {
    await this.get(id, ownerId);
    await this.ensureOwnsAds(ownerId, adIds);

    await this.prisma.campaignAd.createMany({
      data: adIds.map((adId, sortOrder) => ({ campaignId: id, adId, sortOrder })),
      skipDuplicates: true,
    });

    await this.audit.write({
      actorId: ownerId,
      action: 'campaigns.add_ads',
      entityType: 'campaign',
      entityId: id,
      after: { adIds },
    });

    return this.get(id, ownerId);
  }

  async updateStatus(id: string, ownerId: string, status: CampaignStatus) {
    const before = await this.get(id, ownerId);
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status },
      include: { ads: true },
    });

    await this.audit.write({
      actorId: ownerId,
      action: 'campaigns.status_update',
      entityType: 'campaign',
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async pause(id: string, ownerId: string) {
    const before = await this.get(id, ownerId);
    assertCampaignCanPause(before);
    return this.transitionStatus(id, ownerId, before.status, 'PAUSED', 'campaigns.pause');
  }

  async resume(id: string, ownerId: string) {
    const before = await this.get(id, ownerId);
    assertCampaignCanResume(before);
    return this.transitionStatus(id, ownerId, before.status, 'ACTIVE', 'campaigns.resume');
  }

  async activate(id: string, ownerId: string) {
    const before = await this.get(id, ownerId);
    assertCampaignCanActivate({
      ...before,
      adCount: before.ads.length,
    });
    return this.transitionStatus(id, ownerId, before.status, 'ACTIVE', 'campaigns.activate');
  }

  async report(id: string, ownerId?: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { ads: { select: { adId: true } } },
    });
    if (!campaign) throw new NotFoundException('CAMPAIGN_NOT_FOUND');
    if (ownerId && campaign.ownerId !== ownerId) throw new ForbiddenException();

    const adIds = campaign.ads.map((row) => row.adId);
    const events =
      adIds.length > 0
        ? await this.prisma.analyticsEvent.findMany({
            where: {
              adId: { in: adIds },
              name: { in: REPORT_EVENTS },
              createdAt: {
                ...(campaign.startsAt ? { gte: campaign.startsAt } : {}),
                ...(campaign.endsAt ? { lte: campaign.endsAt } : {}),
              },
            },
            select: { name: true },
          })
        : [];

    return {
      campaignId: campaign.id,
      status: campaign.status,
      budgetTotal: campaign.budgetTotal,
      currency: campaign.currency,
      adCount: adIds.length,
      dateRange: {
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
      },
      metrics: {
        impressions: events.filter((event) => IMPRESSION_EVENTS.includes(event.name)).length,
        clicks: events.filter((event) => CLICK_EVENTS.includes(event.name)).length,
        saves: events.filter((event) => SAVE_EVENTS.includes(event.name)).length,
      },
    };
  }

  private async ensureOwnsAds(ownerId: string, adIds: string[]) {
    const unique = [...new Set(adIds)];
    const count = await this.prisma.ad.count({
      where: { id: { in: unique }, ownerId, deletedAt: null },
    });
    if (count !== unique.length) throw new NotFoundException('AD_NOT_FOUND');
  }

  private async ensureTargetingExists(targeting?: CampaignTargeting) {
    if (!targeting) return;
    const cityIds = [...new Set(targeting.cityIds ?? [])];
    if (cityIds.length > 0) {
      const count = await this.prisma.city.count({ where: { id: { in: cityIds } } });
      if (count !== cityIds.length) throw new NotFoundException('CITY_NOT_FOUND');
    }

    const categoryIds = [...new Set(targeting.categoryIds ?? [])];
    if (categoryIds.length > 0) {
      const count = await this.prisma.category.count({ where: { id: { in: categoryIds } } });
      if (count !== categoryIds.length) throw new NotFoundException('CATEGORY_NOT_FOUND');
    }
  }

  private async transitionStatus(
    id: string,
    ownerId: string,
    beforeStatus: CampaignStatus,
    afterStatus: CampaignStatus,
    action: string,
  ) {
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: afterStatus },
      include: { ads: true },
    });

    await this.audit.write({
      actorId: ownerId,
      action,
      entityType: 'campaign',
      entityId: id,
      before: { status: beforeStatus },
      after: { status: updated.status },
    });

    return updated;
  }
}
