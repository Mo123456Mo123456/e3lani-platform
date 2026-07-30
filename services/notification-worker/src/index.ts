import { connect, JSONCodec } from "nats";
import postgres from "postgres";
import type { RealtimeDelta, WorldEvent } from "@living-planet/shared-types";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 4 });
const nats = await connect({
  servers: process.env.NATS_URL ?? "nats://localhost:4222",
  name: "living-planet-notification-worker",
});
const codec = JSONCodec<RealtimeDelta>();
const subscription = nats.subscribe("world.delta.*");

for await (const message of subscription) {
  const delta = codec.decode(message.data);
  if (delta.kind !== "event.created") continue;
  const event = delta.payload as WorldEvent;
  if (!event.contributionId || event.type === "CONTRIBUTION_INTRODUCED") continue;
  await sql`
    INSERT INTO notifications (user_id, event_id, type, title, body)
    SELECT
      c.user_id, ${event.id}, 'contribution.effect', ${event.title},
      ${`A later effect of your contribution occurred in year ${event.year}: ${event.summary}`}
    FROM user_contributions c
    WHERE c.id = ${event.contributionId}
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = c.user_id AND n.event_id = ${event.id}
      )
  `;
}
