import "dotenv/config";
import { connect } from "@nats-io/transport-node";
import postgres from "postgres";
import type { WorldEvent } from "@living-planet/shared-types";

const natsUrl = process.env.NATS_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!natsUrl || !databaseUrl) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("NATS_URL and DATABASE_URL are required");
  }
  console.info(
    JSON.stringify({
      level: "info",
      service: "notification-worker",
      status: "disabled",
      reason: "NATS_URL or DATABASE_URL is not configured",
    }),
  );
} else {
  const sql = postgres(databaseUrl, { max: 4 });
  const nats = await connect({ servers: natsUrl, name: "notification-worker" });
  type WorldDelta = {
    planetId: string;
    version: number;
    tick: number;
    events: WorldEvent[];
  };
  const decoder = new TextDecoder();
  const subscription = nats.subscribe("world.delta", { queue: "notifications" });

  console.info(
    JSON.stringify({ level: "info", service: "notification-worker", status: "ready" }),
  );

  for await (const message of subscription) {
    const delta = JSON.parse(decoder.decode(message.data)) as WorldDelta;
    for (const event of delta.events) {
      if (!event.ownerUserId || !event.contributionId) continue;
      const title =
        event.type === "SPECIES_CREATED"
          ? "ظهر أول مخلوق مرتبط بمساهمتك"
          : event.type === "WAR_STARTED"
            ? "اندلع نزاع مرتبط بعنصرك"
            : event.type === "MIGRATION_STARTED"
              ? "امتد تأثير مساهمتك إلى منطقة جديدة"
              : "تطور أثر مساهمتك";
      await sql`
        insert into notifications (user_id, contribution_id, event_id, type, title, body)
        select ${event.ownerUserId}, ${event.contributionId}, ${event.id}, ${event.type},
               ${title}, ${event.descriptionAr}
        where not exists (select 1 from notifications where event_id = ${event.id})
      `;
    }
  }

  await nats.drain();
  await sql.end();
}
