import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TickUnit } from "@prisma/client";
import { RedisPublisherService } from "../common/redis/redis-publisher.service";
import { SimulationEngineService } from "../common/services/simulation-engine.service";
import { PrismaService } from "../prisma/prisma.service";
import { RollbackDto, SimulationTickDto } from "./dto/simulation.dto";

@Injectable()
export class SimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulation: SimulationEngineService,
    private readonly redis: RedisPublisherService,
  ) {}

  async tick(planetId: string, dto: SimulationTickDto = {}) {
    const planet = await this.prisma.planet.findUnique({ where: { id: planetId } });
    if (!planet) {
      throw new NotFoundException("Planet not found");
    }

    const result = await this.simulation.tick({
      planetId,
      currentTick: planet.currentTick,
      currentYear: planet.currentYear,
      unit: planet.tickUnit,
      steps: dto.steps ?? 1,
    });

    const nextTick = numberFrom(result.tick) ?? planet.currentTick + (dto.steps ?? 1);
    const nextYear = numberFrom(result.year) ?? planet.currentYear + (dto.steps ?? 1);

    const saved = await this.prisma.$transaction(async (tx) => {
      const updatedPlanet = await tx.planet.update({
        where: { id: planetId },
        data: {
          currentTick: nextTick,
          currentYear: nextYear,
        },
      });

      const simulationTick = await tx.simulationTick.upsert({
        where: { planetId_tick: { planetId, tick: nextTick } },
        create: {
          planetId,
          tick: nextTick,
          year: nextYear,
          unit: planet.tickUnit as TickUnit,
          summary: (result.summary ?? result) as Prisma.InputJsonValue,
        },
        update: {
          year: nextYear,
          summary: (result.summary ?? result) as Prisma.InputJsonValue,
        },
      });

      const events = [];
      for (const event of normalizeTickEvents(result, planetId, nextTick, nextYear)) {
        events.push(await tx.worldEvent.create({ data: event }));
      }

      return { updatedPlanet, simulationTick, events };
    });

    await this.redis.publishDelta({
      type: "tick",
      planetId,
      tick: nextTick,
      payload: {
        tick: saved.simulationTick,
        eventIds: saved.events.map((event) => event.id),
      },
    });

    return { ...saved, simulation: result };
  }

  async rollback(planetId: string, dto: RollbackDto) {
    const planet = await this.prisma.planet.findUnique({
      where: { id: planetId },
      select: { id: true },
    });
    if (!planet) {
      throw new NotFoundException("Planet not found");
    }

    const result = await this.simulation.rollback({
      planetId,
      targetTick: dto.targetTick,
      reason: dto.reason,
    });

    await this.redis.publishDelta({
      type: "tick",
      planetId,
      tick: dto.targetTick,
      payload: { rollback: result },
    });

    return result;
  }
}

function normalizeTickEvents(
  payload: Record<string, unknown>,
  planetId: string,
  tick: number,
  year: number,
): Prisma.WorldEventCreateManyInput[] {
  const events = Array.isArray(payload.events) ? payload.events : [];
  return events
    .filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === "object")
    .map((event) => ({
      planetId,
      type: stringFrom(event.type) ?? "TICK_COMPLETED",
      title: stringFrom(event.title) ?? "Simulation tick completed",
      titleAr: stringFrom(event.titleAr) ?? stringFrom(event.title_ar) ?? "اكتملت خطوة المحاكاة",
      description: stringFrom(event.description) ?? "The planet advanced one simulation step.",
      descriptionAr:
        stringFrom(event.descriptionAr) ??
        stringFrom(event.description_ar) ??
        "تقدم الكوكب خطوة واحدة في المحاكاة.",
      tick: numberFrom(event.tick) ?? tick,
      year: numberFrom(event.year) ?? year,
      importance: numberFrom(event.importance) ?? 0.25,
      regionId: stringFrom(event.regionId) ?? stringFrom(event.region_id),
      lat: numberFrom(event.lat),
      lon: numberFrom(event.lon),
      causeIds: stringArrayFrom(event.causeIds) ?? stringArrayFrom(event.cause_ids) ?? [],
      userId: stringFrom(event.userId) ?? stringFrom(event.user_id),
      confidence: numberFrom(event.confidence) ?? 1,
      directImpact: (event.directImpact ?? event.direct_impact ?? {}) as Prisma.InputJsonValue,
      thumbnailUrl: stringFrom(event.thumbnailUrl) ?? stringFrom(event.thumbnail_url),
    }));
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArrayFrom(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}
