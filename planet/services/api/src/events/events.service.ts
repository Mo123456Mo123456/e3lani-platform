import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  /** Cursor-paginated event feed from Postgres (newest first). */
  async query(
    planetId: string,
    opts: { beforeSeq?: number; limit?: number; type?: string; contributionId?: string },
  ) {
    const limit = Math.min(opts.limit ?? 40, 200);
    const where = {
      planetId,
      ...(opts.beforeSeq !== undefined ? { seq: { lt: opts.beforeSeq } } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.contributionId ? { contributionId: opts.contributionId } : {}),
    };
    const [events, total] = await Promise.all([
      this.prisma.worldEvent.findMany({
        where,
        orderBy: { seq: "desc" },
        take: limit + 1,
      }),
      this.prisma.worldEvent.count({ where: { planetId } }),
    ]);
    const hasMore = events.length > limit;
    const page = events.slice(0, limit);
    return {
      events: page,
      nextCursor: hasMore ? page[page.length - 1]?.seq ?? null : null,
      total,
    };
  }

  /** Full causal neighborhood of an event (ancestors + descendants). */
  async causalChain(planetId: string, seq: number) {
    const links = await this.prisma.causalLink.findMany({ where: { planetId } });
    const children = new Map<number, number[]>();
    const parents = new Map<number, number[]>();
    for (const l of links) {
      children.set(l.fromSeq, [...(children.get(l.fromSeq) ?? []), l.toSeq]);
      parents.set(l.toSeq, [...(parents.get(l.toSeq) ?? []), l.fromSeq]);
    }
    const walk = (start: number, map: Map<number, number[]>, depth: number): number[] => {
      const seen = new Set<number>();
      const queue: { s: number; d: number }[] = [{ s: start, d: 0 }];
      while (queue.length > 0) {
        const { s, d } = queue.shift()!;
        if (d > depth || seen.has(s)) continue;
        seen.add(s);
        for (const n of map.get(s) ?? []) queue.push({ s: n, d: d + 1 });
      }
      seen.delete(start);
      return [...seen];
    };
    const ancestors = walk(seq, parents, 16);
    const descendants = walk(seq, children, 16);
    const seqs = [seq, ...ancestors, ...descendants];
    const events = await this.prisma.worldEvent.findMany({
      where: { planetId, seq: { in: seqs } },
      orderBy: { seq: "asc" },
    });
    return { root: seq, ancestors, descendants, events };
  }
}
