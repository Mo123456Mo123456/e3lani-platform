import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReportAdInput } from '@e3lani/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(adId: string, reporterId: string, input: ReportAdInput) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.deletedAt) throw new NotFoundException('AD_NOT_FOUND');

    const report = await this.prisma.report.create({
      data: {
        adId,
        reporterId,
        reason: input.reason,
        details: input.details,
      },
    });

    await this.audit.write({
      actorId: reporterId,
      action: 'reports.create',
      entityType: 'report',
      entityId: report.id,
      after: { adId, reason: input.reason },
    });

    return report;
  }

  mine(reporterId: string) {
    return this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      include: {
        ad: { select: { id: true, status: true, currentRevision: { select: { title: true } } } },
      },
    });
  }

  listAdmin() {
    return this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { select: { id: true, phone: true, displayName: true } },
        ad: { select: { id: true, status: true, currentRevision: { select: { title: true } } } },
      },
    });
  }

  async resolve(
    id: string,
    actorId: string,
    input: { status?: string; resolution?: string },
  ) {
    const before = await this.prisma.report.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('REPORT_NOT_FOUND');

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: input.status ?? before.status,
        resolution: input.resolution,
        resolvedAt: input.resolution ? new Date() : before.resolvedAt,
        resolvedById: input.resolution ? actorId : before.resolvedById,
      },
    });

    await this.audit.write({
      actorId,
      action: 'reports.resolve',
      entityType: 'report',
      entityId: id,
      before: { status: before.status, resolution: before.resolution },
      after: { status: updated.status, resolution: updated.resolution },
    });

    return updated;
  }
}
