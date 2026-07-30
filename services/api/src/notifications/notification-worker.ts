import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { WorldEvent, WorldEventType } from "@kawkab/shared-types";
import { EventBus } from "../common/event-bus.js";
import { PrismaService } from "../common/prisma.service.js";

/** which events notify a contribution's owner, and how they read */
const NOTIFY_RULES: Partial<Record<WorldEventType, { type: string; titleAr: string; titleEn: string }>> = {
  SPECIES_CREATED: { type: "first_dependent", titleAr: "ظهر مخلوق مرتبط بإضافتك", titleEn: "A creature linked to your addition appeared" },
  SPECIES_MIGRATED: { type: "spread", titleAr: "انتشر عنصرك إلى أرض جديدة", titleEn: "Your element spread to new land" },
  PLANTS_SPREAD: { type: "spread", titleAr: "نباتك يستعمر مناطق جديدة", titleEn: "Your plant is colonising new regions" },
  TECHNOLOGY_DISCOVERED: { type: "adopted", titleAr: "تبنّت حضارة اختراعك", titleEn: "A civilization adopted your invention" },
  TRADE_ROUTE_CREATED: { type: "trade", titleAr: "موردك أنشأ طريق تجارة", titleEn: "Your resource sparked a trade route" },
  WAR_STARTED: { type: "war", titleAr: "اندلعت حرب مرتبطة بعنصرك", titleEn: "A war linked to your element broke out" },
  SPECIES_EXTINCT: { type: "extinction", titleAr: "انقرض المخلوق الذي أنشأته", titleEn: "Your creature went extinct" },
  CIVILIZATION_FOUNDED: { type: "founded", titleAr: "حضارتك ترسخت", titleEn: "Your civilization took root" },
  CLIMATE_CHANGED: { type: "climate", titleAr: "عنصرك غيّر المناخ", titleEn: "Your element shifted the climate" },
};

/**
 * The notification worker: listens to the event bus, and when a contribution
 * descendant event is noteworthy, writes a notification for its owner.
 */
@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorker.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.bus.subscribe("world.event", ({ planetId, event }) => {
      void this.handle(planetId, event).catch((err) => this.logger.warn(String(err)));
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  async handle(planetId: string, event: WorldEvent): Promise<void> {
    if (!event.contributionId || event.type === "ELEMENT_ADDED") return;
    const rule = NOTIFY_RULES[event.type];
    if (!rule || event.magnitude < 0.25) return;
    const contribution = await this.prisma.userContribution.findUnique({ where: { id: event.contributionId } });
    if (!contribution) return;
    // bump impact counters — the contribution page reads these
    await this.prisma.userContribution.update({
      where: { id: contribution.id },
      data: { eventCount: { increment: 1 }, impactScore: { increment: event.magnitude } },
    });
    // de-duplicate bursts: one notification per (type, contribution) per 50 ticks
    const recent = await this.prisma.notification.findFirst({
      where: { userId: contribution.userId, type: rule.type, data: { path: ["contributionId"], equals: contribution.id }, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent) return;
    await this.prisma.notification.create({
      data: {
        userId: contribution.userId,
        type: rule.type,
        title: rule.titleAr,
        body: event.summary,
        data: {
          contributionId: contribution.id,
          eventId: event.id,
          eventType: event.type,
          tick: event.tick,
          region: event.region as object | null,
          titleEn: rule.titleEn,
        },
      },
    });
  }
}
