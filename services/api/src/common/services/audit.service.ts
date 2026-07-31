import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorAdminId?: string | null;
  actorUserId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** سجل إجراءات كامل لكل عملية حساسة داخل المنصة. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          actorAdminId: entry.actorAdminId ?? null,
          actorUserId: entry.actorUserId ?? null,
          before: (entry.before ?? null) as any,
          after: (entry.after ?? null) as any,
          reason: entry.reason ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      // سجل الإجراءات لا يجب أن يُسقط العملية الأساسية أبدًا
      this.logger.error(`تعذّر تسجيل الإجراء ${entry.action}: ${(error as Error).message}`);
    }
  }
}
