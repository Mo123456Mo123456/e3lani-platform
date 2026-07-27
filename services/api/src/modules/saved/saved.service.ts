import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { decorateAdMedia } from '../../common/media-urls';

@Injectable()
export class SavedService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.savedAd.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        ad: {
          include: {
            currentRevision: { include: { category: true, city: true } },
            owner: {
              select: { id: true, displayName: true, brandProfile: true },
            },
            media: { include: { asset: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    return rows.map((row) => ({
      ...row,
      ad: {
        ...row.ad,
        media: decorateAdMedia(row.ad.media),
      },
    }));
  }

  async save(userId: string, adId: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.deletedAt) throw new NotFoundException('AD_NOT_FOUND');
    return this.prisma.savedAd.upsert({
      where: { userId_adId: { userId, adId } },
      create: { userId, adId },
      update: {},
    });
  }

  async unsave(userId: string, adId: string) {
    await this.prisma.savedAd.deleteMany({ where: { userId, adId } });
    return { ok: true };
  }
}
