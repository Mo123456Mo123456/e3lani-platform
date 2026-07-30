
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { loadEnv } from "@kawkab/config";

export type DeltaTopic = "world.event" | "contribution.status" | "simulation.tick" | "notification.created";
export interface DeltaMessage {
  topic: DeltaTopic;
  payload: unknown;
  createdAt: string;
}

const env = loadEnv();
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
    return;
  }
  if (request.method === "POST" && request.url === "/broadcast") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        const parsed = JSON.parse(body) as { topic: DeltaTopic; payload: unknown };
        if (!parsed.topic) throw new Error("topic required");
        const message = { topic: parsed.topic, payload: parsed.payload, createdAt: new Date().toISOString() } satisfies DeltaMessage;
        broadcast(message);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
      } catch (error) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "invalid broadcast" }));
      }
    });
    return;
  }
  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

export const wss = new WebSocketServer({ server });

export function broadcast(message: DeltaMessage): void {
  const encoded = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(encoded);
  }
}

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ topic: "simulation.tick", payload: { status: "connected" }, createdAt: new Date().toISOString() } satisfies DeltaMessage));
});

server.listen(env.REALTIME_PORT, "0.0.0.0", () => {
  console.log(`Realtime gateway listening on ws://0.0.0.0:${env.REALTIME_PORT}`);
});
