import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateAppealInput } from '@e3lani/validation';
import { AppealStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class AppealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, input: CreateAppealInput) {
    const ad = await this.prisma.ad.findUnique({ where: { id: input.adId } });
    if (!ad || ad.deletedAt) throw new NotFoundException('AD_NOT_FOUND');
    if (input.reportId) {
      const report = await this.prisma.report.findUnique({ where: { id: input.reportId } });
      if (!report || report.adId !== input.adId) throw new BadRequestException('REPORT_NOT_FOR_AD');
    }

    const appeal = await this.prisma.appeal.create({
      data: {
        userId,
        adId: input.adId,
        reportId: input.reportId,
        reason: input.reason,
        details: input.details,
      },
    });

    await this.audit.write({
      actorId: userId,
      action: 'appeals.create',
      entityType: 'appeal',
      entityId: appeal.id,
      after: { adId: input.adId, reportId: input.reportId ?? null },
    });

    return appeal;
  }

  mine(userId: string) {
    return this.prisma.appeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        ad: { select: { id: true, status: true, currentRevision: { select: { title: true } } } },
        report: { select: { id: true, status: true, reason: true } },
      },
    });
  }

  listAdmin() {
    return this.prisma.appeal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, phone: true, displayName: true } },
        ad: { select: { id: true, status: true, currentRevision: { select: { title: true } } } },
        report: { select: { id: true, status: true, reason: true } },
      },
    });
  }

  async decide(id: string, actorId: string, input: { status: AppealStatus; decisionNote?: string }) {
    const before = await this.prisma.appeal.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('APPEAL_NOT_FOUND');

    const updated = await this.prisma.appeal.update({
      where: { id },
      data: {
        status: input.status,
        decisionNote: input.decisionNote,
        decidedAt: new Date(),
        decidedById: actorId,
      },
    });

    await this.audit.write({
      actorId,
      action: 'appeals.decide',
      entityType: 'appeal',
      entityId: id,
      before: { status: before.status, decisionNote: before.decisionNote },
      after: { status: updated.status, decisionNote: updated.decisionNote },
    });

    return updated;
  }
}
