import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { connect, JSONCodec } from "nats";
import type { RealtimeDelta } from "@living-planet/shared-types";

interface SocketLike {
  readyState: number;
  send(data: string): void;
}

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: [process.env.WEB_ORIGIN ?? "http://localhost:3000"],
    credentials: true,
  });
  await app.register(websocket);

  const nats = await connect({
    servers: process.env.NATS_URL ?? "nats://localhost:4222",
    name: "living-planet-realtime-gateway",
    timeout: 2_000,
    maxReconnectAttempts: -1,
  });
  const subscription = nats.subscribe("world.delta.*");
  const clients = new Set<SocketLike>();
  const codec = JSONCodec<RealtimeDelta>();

  void (async () => {
    for await (const message of subscription) {
      const serialized = JSON.stringify(codec.decode(message.data));
      for (const client of clients) if (client.readyState === 1) client.send(serialized);
    }
  })();

  app.get("/health", async () => ({
    status: nats.isClosed() ? "degraded" : "ok",
    clients: clients.size,
    transport: "nats-jetstream-compatible-deltas",
  }));
  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({
      sequence: 0,
      planetId: "00000000-0000-4000-8000-000000000001",
      tick: 0,
      kind: "simulation.status",
      payload: { connected: true, gateway: true },
    } satisfies RealtimeDelta));
    socket.on("close", () => clients.delete(socket));
  });

  app.addHook("onClose", async () => {
    subscription.unsubscribe();
    await nats.drain();
  });
  await app.listen({ host: "0.0.0.0", port: Number(process.env.REALTIME_PORT ?? 4100) });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
