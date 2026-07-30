import { WebSocketServer } from "ws";
import { loadEnv } from "@kawkab/config";

export type DeltaTopic = "world.event" | "contribution.status" | "simulation.tick";
export interface DeltaMessage {
  topic: DeltaTopic;
  payload: unknown;
  createdAt: string;
}

const env = loadEnv();
export const wss = new WebSocketServer({ port: env.REALTIME_PORT });

export function broadcast(message: DeltaMessage): void {
  const encoded = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(encoded);
  }
}

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ topic: "simulation.tick", payload: { status: "connected" }, createdAt: new Date().toISOString() } satisfies DeltaMessage));
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Realtime gateway listening on ws://0.0.0.0:${env.REALTIME_PORT}`);
}
