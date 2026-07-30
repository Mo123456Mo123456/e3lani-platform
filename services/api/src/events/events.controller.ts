import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../common/prisma.service.js";

@ApiTags("events")
@Controller("planets/:planetId/events")
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Param("planetId") planetId: string,
    @Query("types") types?: string,
    @Query("fromTick") fromTick?: string,
    @Query("contributionId") contributionId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? "30", 10) || 30));
    const where = {
      planetId,
      ...(types ? { type: { in: types.split(",") } } : {}),
      ...(fromTick ? { tick: { gte: parseInt(fromTick, 10) } } : {}),
      ...(contributionId ? { contributionId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.worldEvent.findMany({ where, orderBy: [{ tick: "desc" }, { createdAt: "desc" }], skip: (p - 1) * ps, take: ps }),
      this.prisma.worldEvent.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Get("timeline")
  async timeline(@Param("planetId") planetId: string, @Query("limit") limit?: string) {
    const take = Math.min(400, parseInt(limit ?? "200", 10) || 200);
    const items = await this.prisma.worldEvent.findMany({
      where: { planetId, magnitude: { gte: 0.4 } },
      orderBy: { simYear: "asc" },
      take,
      select: { tick: true, simYear: true, type: true, title: true, magnitude: true },
    });
    return items;
  }

  @Get(":eventId/chain")
  async chain(@Param("planetId") planetId: string, @Param("eventId") eventId: string, @Query("depth") depth?: string) {
    const maxDepth = Math.min(6, parseInt(depth ?? "4", 10) || 4);
    const root = await this.prisma.worldEvent.findFirst({ where: { planetId, OR: [{ id: eventId }, { key: eventId }] } });
    if (!root) throw new NotFoundException("event not found");
    const build = async (id: string, level: number): Promise<unknown> => {
      if (level >= maxDepth) return null;
      const links = await this.prisma.causalLink.findMany({
        where: { causeEventId: id },
        include: { effect: true },
        take: 25,
      });
      return {
        children: await Promise.all(links.map(async (l) => ({ event: l.effect, children: await build(l.effectEventId, level + 1) }))),
      };
    };
    const tree = await build(root.id, 0);
    const descendants = await this.prisma.causalLink.count({ where: { causeEventId: root.id } });
    return { root, tree, directDescendants: descendants };
  }
}
