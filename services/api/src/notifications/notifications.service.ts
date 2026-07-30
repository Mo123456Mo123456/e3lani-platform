import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { NotificationDto } from "@planet/shared-types";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";
import type { EngineEvent } from "../simulation/engine-client.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

const TEMPLATES: Record<string, { ar: string; en: string }> = {
  "war_started.contribution": {
    ar: "اندلعت حرب مرتبطة بالعنصر الذي أضفته إلى العالم.",
    en: "A war linked to your contribution has broken out.",
  },
  "species_extinct.contribution": {
    ar: "انقرض النوع الذي أنشأته.",
    en: "The species you created has gone extinct.",
  },
  "plant_spread.contribution": {
    ar: "انتشر نباتك إلى مناطق جديدة من الكوكب.",
    en: "Your plant spread into new regions of the planet.",
  },
  "species_migrated.contribution": {
    ar: "هاجر مخلوقك إلى موطن جديد.",
    en: "Your creature migrated to a new habitat.",
  },
  "species_mutated.contribution": {
    ar: "تفرّع نوع جديد من مخلوقك عبر الطفرات.",
    en: "A new subspecies branched off your creature.",
  },
  "trade_route.contribution": {
    ar: "تسبّب موردك في إنشاء طريق تجاري جديد.",
    en: "Your resource caused a new trade route to form.",
  },
  "technology.contribution": {
    ar: "استُخدم اختراعك داخل العالم.",
    en: "Your invention was adopted in the world.",
  },
  "civilization.contribution": {
    ar: "تطورت الحضارة التي أسستها.",
    en: "The civilization you founded is evolving.",
  },
};

const EVENT_TO_TEMPLATE: Record<string, string> = {
  WAR_STARTED: "war_started.contribution",
  SPECIES_EXTINCT: "species_extinct.contribution",
  PLANT_SPREAD: "plant_spread.contribution",
  SPECIES_MIGRATED: "species_migrated.contribution",
  SPECIES_MUTATED: "species_mutated.contribution",
  TRADE_ROUTE_CREATED: "trade_route.contribution",
  TECHNOLOGY_DISCOVERED: "technology.contribution",
  CIVILIZATION_FOUNDED: "civilization.contribution",
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly gateway: RealtimeGateway,
  ) {}

  async create(
    userId: string,
    kind: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const row = await this.db
      .insertInto("notifications")
      .values({ user_id: userId, kind, title, body, data })
      .returning(["id", "created_at"])
      .executeTakeFirstOrThrow();
    const dto: NotificationDto = {
      id: row.id,
      userId,
      kind,
      title,
      body,
      data,
      read: false,
      createdAt: row.created_at.toISOString(),
    };
    this.gateway.emitToUser(userId, "notification:new", { notification: dto });
  }

  /** Contribution-impact rules: notify owners when their element's causal
   * subtree produces notable events. */
  async processEvents(planetId: string, events: EngineEvent[]): Promise<void> {
    const withContribution = events.filter(
      (e) => e.contributionId && EVENT_TO_TEMPLATE[e.type] && e.importance >= 2,
    );
    if (!withContribution.length) return;
    const contributionIds = [...new Set(withContribution.map((e) => e.contributionId as string))];
    const contributions = await this.db
      .selectFrom("user_contributions")
      .select(["id", "user_id", "name"])
      .where("planet_id", "=", planetId)
      .where("id", "in", contributionIds)
      .execute();
    const ownerById = new Map(contributions.map((c) => [c.id, c]));
    for (const event of withContribution) {
      const contribution = ownerById.get(event.contributionId as string);
      if (!contribution) continue;
      const template = TEMPLATES[EVENT_TO_TEMPLATE[event.type] as string];
      if (!template) continue;
      await this.create(
        contribution.user_id,
        "contribution.impact",
        contribution.name ?? "مساهمتك",
        template.ar,
        {
          en: template.en,
          contributionId: contribution.id,
          eventId: event.id,
          eventType: event.type,
          tick: event.tick,
        },
      );
    }
  }

  async listForUser(userId: string): Promise<NotificationDto[]> {
    const rows = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .limit(50)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      data: r.data as Record<string, unknown>,
      read: r.read,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.db
      .updateTable("notifications")
      .set({ read: true })
      .where("user_id", "=", userId)
      .where("id", "=", id)
      .execute();
  }
}
