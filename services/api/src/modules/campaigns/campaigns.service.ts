import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateCampaignInput } from '@e3lani/validation';
import { CampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

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

  private async ensureOwnsAds(ownerId: string, adIds: string[]) {
    const unique = [...new Set(adIds)];
    const count = await this.prisma.ad.count({
      where: { id: { in: unique }, ownerId, deletedAt: null },
    });
    if (count !== unique.length) throw new NotFoundException('AD_NOT_FOUND');
  }
}
