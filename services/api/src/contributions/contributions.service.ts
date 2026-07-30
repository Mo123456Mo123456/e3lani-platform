import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { BiomeType, ElementCategory, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { AiOrchestratorService } from "../common/services/ai-orchestrator.service";
import { SimulationEngineService } from "../common/services/simulation-engine.service";
import { RedisPublisherService } from "../common/redis/redis-publisher.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/decorators/current-user.decorator";
import {
  AnalyzeContributionDto,
  CreateContributionDto,
  ElementDto,
  PreviewContributionDto,
} from "./dto/contribution.dto";

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestratorService,
    private readonly simulation: SimulationEngineService,
    private readonly redis: RedisPublisherService,
  ) {}

  async analyze(dto: AnalyzeContributionDto, user: RequestUser) {
    const startedAt = Date.now();
    try {
      const result = await this.ai.analyzeContribution(dto);
      await this.recordAiRequest(user.id, "analyze-contribution", Date.now() - startedAt, true);
      return result;
    } catch (error) {
      await this.recordAiRequest(user.id, "analyze-contribution", Date.now() - startedAt, false);
      throw error;
    }
  }

  async preview(dto: PreviewContributionDto) {
    const { planet } = await this.ensurePlanetAndRegion(dto.planetId, dto.regionId);
    await this.simulation.ensureWorld({ seed: planet.seed, planetId: planet.id });
    return this.simulation.forecast({
      planetId: dto.planetId,
      seed: planet.seed,
      regionId: dto.regionId,
      element: dto.element,
      mode: "lightweight",
    });
  }

  async create(dto: CreateContributionDto, user: RequestUser) {
    const { planet, region } = await this.ensurePlanetAndRegion(dto.planetId, dto.regionId);
    const moderationText = `${dto.element.name}\n${dto.element.nameAr ?? ""}\n${dto.element.description}`;
    const moderation = await this.ai.moderate({
      text: moderationText,
      locale: user.locale,
    });

    await this.prisma.moderationResult.create({
      data: {
        textHash: hashText(moderationText),
        allowed: Boolean(moderation.allowed),
        labels: moderation.labels ?? [],
        reason: moderation.reason,
      },
    });

    if (!moderation.allowed) {
      throw new BadRequestException({
        message: moderation.reason ?? "Contribution was rejected by moderation",
        code: "CONTRIBUTION_REJECTED",
        details: { labels: moderation.labels ?? [] },
      });
    }

    const contribution = await this.prisma.userContribution.create({
      data: {
        planetId: planet.id,
        userId: user.id,
        category: dto.element.category as ElementCategory,
        name: dto.element.name,
        nameAr: dto.element.nameAr ?? dto.element.name,
        description: dto.element.description,
        traitsJson: dto.element.traits as Prisma.InputJsonValue,
        biomes: dto.element.possibleBiomes as BiomeType[],
        risks: dto.element.risks,
        benefits: dto.element.benefits,
        balanceScore: dto.element.balanceScore,
        wasBalanced: dto.element.wasBalanced ?? false,
        regionId: region?.id,
        lat: region?.lat,
        lon: region?.lon,
        status: "pending",
      },
    });

    let applyResult: Record<string, unknown>;
    try {
      await this.simulation.ensureWorld({ seed: planet.seed, planetId: planet.id });
      applyResult = await this.simulation.applyContribution({
        planetId: planet.id,
        seed: planet.seed,
        regionId: region?.id,
        lat: region?.lat,
        lon: region?.lon,
        gridX: (region as { gridX?: number } | null | undefined)?.gridX,
        gridY: (region as { gridY?: number } | null | undefined)?.gridY,
        userId: user.id,
        element: {
          ...dto.element,
          type: dto.element.category,
          properties: dto.element.traits ?? {},
          traits: dto.element.traits ?? {},
        },
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        await this.prisma.userContribution.update({
          where: { id: contribution.id },
          data: { status: "simulation_failed" },
        });
      }
      throw error;
    }

    const saved = await this.persistApplyResult({
      planet,
      region,
      element: dto.element,
      contributionId: contribution.id,
      user,
      applyResult,
    });

    await this.redis.publishDelta({
      type: "contribution",
      planetId: planet.id,
      tick: planet.currentTick,
      payload: {
        contributionId: contribution.id,
        eventIds: saved.events.map((event) => event.id),
      },
    });

    return {
      contribution: saved.contribution,
      events: saved.events,
      causalLinks: saved.causalLinks,
      notification: saved.notification,
      simulation: applyResult,
    };
  }

  private async persistApplyResult(input: {
    planet: { id: string; currentTick: number; currentYear: number };
    region?: { id: string; lat: number; lon: number } | null;
    element: ElementDto;
    contributionId: string;
    user: RequestUser;
    applyResult: Record<string, unknown>;
  }) {
    const events = normalizeEvents(input.applyResult, {
      planetId: input.planet.id,
      contributionId: input.contributionId,
      userId: input.user.id,
      regionId: input.region?.id,
      lat: input.region?.lat,
      lon: input.region?.lon,
      tick: input.planet.currentTick,
      year: input.planet.currentYear,
      element: input.element,
    });

    const causalLinks = normalizeCausalLinks(input.applyResult, {
      planetId: input.planet.id,
      tick: input.planet.currentTick,
    });

    return this.prisma.$transaction(async (tx) => {
      const contribution = await tx.userContribution.update({
        where: { id: input.contributionId },
        data: {
          status: "applied",
          appliedTick: input.planet.currentTick,
          narrativeAr: stringFrom(input.applyResult.narrativeAr),
          narrativeEn: stringFrom(input.applyResult.narrativeEn),
          causalGraphJson: jsonFrom(input.applyResult.causalGraph),
          forecastJson: jsonFrom(input.applyResult.forecast),
        },
      });

      const savedEvents = [];
      for (const event of events) {
        savedEvents.push(await tx.worldEvent.create({ data: event }));
      }

      const firstEventId = savedEvents[0]?.id;
      const savedCausalLinks = [];
      for (const link of causalLinks) {
        savedCausalLinks.push(
          await tx.causalLink.create({
            data: {
              ...link,
              eventId: link.eventId ?? firstEventId,
            },
          }),
        );
      }

      const notification = await tx.notification.create({
        data: {
          userId: input.user.id,
          title: "Contribution applied",
          titleAr: "تم تطبيق مساهمتك",
          body: `${input.element.name} changed the planet timeline.`,
          bodyAr: `${input.element.nameAr ?? input.element.name} غيّر مسار الكوكب.`,
          kind: "contribution_applied",
          metaJson: {
            contributionId: input.contributionId,
            planetId: input.planet.id,
            eventIds: savedEvents.map((event) => event.id),
          },
        },
      });

      await tx.user.update({
        where: { id: input.user.id },
        data: {
          xp: { increment: 25 },
          level: { increment: savedEvents.length > 2 ? 1 : 0 },
        },
      });

      await tx.profile.upsert({
        where: { userId: input.user.id },
        create: {
          userId: input.user.id,
          impactScore: savedEvents.reduce((sum, event) => sum + event.importance, 0),
        },
        update: {
          impactScore: {
            increment: savedEvents.reduce((sum, event) => sum + event.importance, 0),
          },
        },
      });

      return {
        contribution,
        events: savedEvents,
        causalLinks: savedCausalLinks,
        notification,
      };
    });
  }

  private async ensurePlanetAndRegion(planetId: string, regionId?: string) {
    const planet = await this.prisma.planet.findUnique({
      where: { id: planetId },
      select: { id: true, seed: true, currentTick: true, currentYear: true },
    });

    if (!planet) {
      throw new NotFoundException("Planet not found");
    }

    if (!regionId) {
      return { planet, region: null };
    }

    const region = await this.prisma.planetRegion.findFirst({
      where: { id: regionId, planetId },
      select: { id: true, lat: true, lon: true, gridX: true, gridY: true },
    });

    if (!region) {
      throw new NotFoundException("Region not found for planet");
    }

    return { planet, region };
  }

  private async recordAiRequest(
    userId: string,
    operation: string,
    latencyMs: number,
    success: boolean,
  ): Promise<void> {
    await this.prisma.aIRequest
      .create({
        data: {
          userId,
          provider: "ai-orchestrator",
          operation,
          latencyMs,
          success,
          sandbox: process.env.AI_SANDBOX_MODE !== "false",
        },
      })
      .catch(() => undefined);
  }
}

function normalizeEvents(
  payload: Record<string, unknown>,
  defaults: {
    planetId: string;
    contributionId: string;
    userId: string;
    regionId?: string;
    lat?: number;
    lon?: number;
    tick: number;
    year: number;
    element: ElementDto;
  },
): Prisma.WorldEventCreateInput[] {
  const rawEvents =
    arrayFrom(payload.events) ??
    arrayFrom(payload.worldEvents) ??
    (payload.event && typeof payload.event === "object" ? [payload.event] : undefined) ??
    [];

  if (rawEvents.length === 0) {
    return [
      {
        planet: { connect: { id: defaults.planetId } },
        contribution: { connect: { id: defaults.contributionId } },
        type: "CONTRIBUTION_APPLIED",
        title: `${defaults.element.name} introduced`,
        titleAr: `تمت إضافة ${defaults.element.nameAr ?? defaults.element.name}`,
        description: defaults.element.description,
        descriptionAr: defaults.element.description,
        tick: defaults.tick,
        year: defaults.year,
        importance: Math.max(defaults.element.balanceScore, 0.1),
        regionId: defaults.regionId,
        lat: defaults.lat,
        lon: defaults.lon,
        causeIds: [defaults.contributionId],
        userId: defaults.userId,
        directImpact: {},
      },
    ];
  }

  return rawEvents.map((raw) => {
    const event = raw as Record<string, unknown>;
    const labels =
      event.labels && typeof event.labels === "object"
        ? (event.labels as Record<string, unknown>)
        : {};
    const labelEn = stringFrom(labels.en);
    const labelAr = stringFrom(labels.ar);
    return {
      planet: { connect: { id: defaults.planetId } },
      contribution: { connect: { id: defaults.contributionId } },
      type: stringFrom(event.type) ?? "CONTRIBUTION_APPLIED",
      title:
        stringFrom(event.title) ??
        labelEn ??
        `${defaults.element.name} introduced`,
      titleAr:
        stringFrom(event.titleAr) ??
        stringFrom(event.title_ar) ??
        labelAr ??
        `تمت إضافة ${defaults.element.nameAr ?? defaults.element.name}`,
      description:
        stringFrom(event.description) ??
        labelEn ??
        defaults.element.description,
      descriptionAr:
        stringFrom(event.descriptionAr) ??
        stringFrom(event.description_ar) ??
        labelAr ??
        stringFrom(event.description) ??
        defaults.element.description,
      tick: numberFrom(event.tick) ?? defaults.tick,
      year: numberFrom(event.year) ?? defaults.year,
      importance: numberFrom(event.importance) ?? numberFrom(event.confidence) ?? defaults.element.balanceScore,
      regionId: stringFrom(event.regionId) ?? stringFrom(event.region_id) ?? defaults.regionId,
      lat: numberFrom(event.lat) ?? defaults.lat,
      lon: numberFrom(event.lon) ?? defaults.lon,
      causeIds: stringArrayFrom(event.causeIds) ?? stringArrayFrom(event.cause_ids) ?? [
        defaults.contributionId,
        stringFrom(event.cause) ?? "",
      ].filter(Boolean),
      userId: defaults.userId,
      confidence: numberFrom(event.confidence) ?? 1,
      directImpact:
        jsonFrom(event.directImpact ?? event.direct_impact ?? event.direct_impacts) ?? {},
      thumbnailUrl: stringFrom(event.thumbnailUrl) ?? stringFrom(event.thumbnail_url),
    };
  });
}

function normalizeCausalLinks(
  payload: Record<string, unknown>,
  defaults: { planetId: string; tick: number },
): Prisma.CausalLinkCreateManyInput[] {
  const directLinks =
    arrayFrom(payload.causalLinks) ??
    arrayFrom(payload.causal_links) ??
    arrayFrom(payload.causal_edges) ??
    arrayFrom(payload.causalEdges);
  const graph = payload.causalGraph ?? payload.causal_graph;
  const graphEdges =
    graph && typeof graph === "object" ? arrayFrom((graph as Record<string, unknown>).edges) : undefined;
  const rawLinks = directLinks ?? graphEdges ?? [];
  const links: Prisma.CausalLinkCreateManyInput[] = [];

  for (const raw of rawLinks) {
    const link = raw as Record<string, unknown>;
    const fromNode =
      stringFrom(link.fromNode) ??
      stringFrom(link.from) ??
      stringFrom(link.source);
    const toNode =
      stringFrom(link.toNode) ??
      stringFrom(link.to) ??
      stringFrom(link.target);
    if (!fromNode || !toNode) {
      continue;
    }

    links.push({
      planetId: defaults.planetId,
      fromNode,
      toNode,
      relation: stringFrom(link.relation) ?? "influences",
      weight: numberFrom(link.weight) ?? 1,
      tick: numberFrom(link.tick) ?? defaults.tick,
      eventId: stringFrom(link.eventId) ?? stringFrom(link.event_id),
    });
  }

  return links;
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayFrom(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function stringArrayFrom(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function jsonFrom(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}
