import { BadRequestException, Injectable } from '@nestjs/common';
import { AdStatus } from '@prisma/client';
import { assertAdTransition, canTransitionAdStatus } from '@e3lani/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdStateService {
  constructor(private readonly prisma: PrismaService) {}

  canTransition(from: AdStatus, to: AdStatus): boolean {
    return canTransitionAdStatus(from, to);
  }

  async transition(params: {
    adId: string;
    to: AdStatus;
    actorId?: string;
    reason?: string;
  }) {
    const ad = await this.prisma.ad.findUniqueOrThrow({ where: { id: params.adId } });
    try {
      assertAdTransition(ad.status, params.to);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ad.update({
        where: { id: params.adId },
        data: { status: params.to },
      });
      await tx.adStatusHistory.create({
        data: {
          adId: params.adId,
          fromStatus: ad.status,
          toStatus: params.to,
          reason: params.reason,
          actorId: params.actorId,
        },
      });
      return updated;
    });
  }
}
