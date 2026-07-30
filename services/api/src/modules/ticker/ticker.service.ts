import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TickerLogoStatus } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';

const createTickerSchema = z.object({
  title: z.string().min(2).max(80),
  logoUrl: z.string().url(),
});

/**
 * Active ticker logos for the non-interactive top strip.
 * Client must: continuous loop, never pause on touch, never open links.
 * Server never returns click URLs — logos only.
 */
@Injectable()
export class TickerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public feed of active logos (no links). Ensures no consecutive duplicates when shuffled for loop. */
  async listActive() {
    const now = new Date();
    const rows = await this.prisma.tickerLogo.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        logoUrl: true,
        sortOrder: true,
      },
    });

    return {
      items: this.interleaveNoAdjacentDupes(rows),
      /** Brand separator token for clients (smaller E3lani mark between logos). */
      brandSeparator: {
        kind: 'e3lani' as const,
        labelAr: 'إعلاني',
        labelEn: 'E3lani',
      },
      interactive: false,
      clickable: false,
      pauseOnTouch: false,
    };
  }

  async create(ownerId: string, body: unknown) {
    const input = createTickerSchema.parse(body);
    const row = await this.prisma.tickerLogo.create({
      data: {
        ownerId,
        title: input.title,
        logoUrl: input.logoUrl,
        status: 'DRAFT',
      },
    });
    await this.audit.write({
      actorId: ownerId,
      action: 'ticker.create',
      entityType: 'ticker_logo',
      entityId: row.id,
    });
    return row;
  }

  async submit(id: string, ownerId: string) {
    const row = await this.getOwned(id, ownerId);
    if (row.status !== 'DRAFT' && row.status !== 'REJECTED') {
      throw new BadRequestException('TICKER_NOT_SUBMITTABLE');
    }
    // FREE_LAUNCH: draft → pending review (logos always need admin approval before strip).
    return this.prisma.tickerLogo.update({
      where: { id },
      data: { status: 'PENDING_REVIEW' },
    });
  }

  async listMine(ownerId: string) {
    return this.prisma.tickerLogo.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAdmin() {
    return this.prisma.tickerLogo.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        owner: { select: { id: true, displayName: true, phone: true } },
      },
      take: 200,
    });
  }

  async decide(
    id: string,
    actorId: string,
    status: Extract<TickerLogoStatus, 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'STOPPED'>,
    reason?: string,
  ) {
    const before = await this.prisma.tickerLogo.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('TICKER_NOT_FOUND');

    const updated = await this.prisma.tickerLogo.update({
      where: { id },
      data: {
        status,
        rejectReason: status === 'REJECTED' ? reason : null,
        reviewedById: actorId,
        reviewedAt: new Date(),
        startsAt: status === 'ACTIVE' ? before.startsAt ?? new Date() : before.startsAt,
      },
    });

    await this.audit.write({
      actorId,
      action: `ticker.${status.toLowerCase()}`,
      entityType: 'ticker_logo',
      entityId: id,
      before: { status: before.status },
      after: { status },
      reason,
    });

    return updated;
  }

  private async getOwned(id: string, ownerId: string) {
    const row = await this.prisma.tickerLogo.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('TICKER_NOT_FOUND');
    if (row.ownerId !== ownerId) throw new ForbiddenException();
    return row;
  }

  private interleaveNoAdjacentDupes<T extends { id: string }>(items: T[]): T[] {
    if (items.length <= 1) return items;
    const result: T[] = [];
    const queue = [...items];
    while (queue.length) {
      let picked = -1;
      for (let i = 0; i < queue.length; i++) {
        if (result.length === 0 || result[result.length - 1].id !== queue[i].id) {
          picked = i;
          break;
        }
      }
      if (picked < 0) picked = 0;
      result.push(queue.splice(picked, 1)[0]);
    }
    return result;
  }
}
