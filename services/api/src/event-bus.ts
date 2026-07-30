import { connect, JSONCodec, type NatsConnection } from "nats";
import type { RealtimeDelta } from "@living-planet/shared-types";

let connection: Promise<NatsConnection> | undefined;
const codec = JSONCodec<RealtimeDelta>();

async function getConnection(): Promise<NatsConnection> {
  connection ??= connect({
    servers: process.env.NATS_URL ?? "nats://localhost:4222",
    name: "living-planet-api",
    timeout: 2_000,
    maxReconnectAttempts: 10,
  });
  return connection;
}

export async function publishDelta(delta: RealtimeDelta): Promise<void> {
  const nats = await getConnection();
  nats.publish(`world.delta.${delta.planetId}`, codec.encode(delta));
}

export async function closeEventBus(): Promise<void> {
  if (!connection) return;
  const nats = await connection;
  await nats.drain();
  connection = undefined;
}
