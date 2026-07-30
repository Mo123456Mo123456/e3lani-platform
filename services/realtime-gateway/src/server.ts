/*
README - @planet/realtime-gateway

Purpose:
- A small Node + TypeScript WebSocket gateway for planet realtime deltas.
- Authenticates clients with a JWT access token passed as ?token= and verified
  with JWT_ACCESS_SECRET.
- Subscribes to Redis channel planet:deltas and relays only delta envelopes to
  sockets subscribed to the matching planet room.
- Never sends full planet state. Clients must fetch snapshots from the API and
  use this gateway only for incremental updates.

Local use:
- pnpm --filter @planet/realtime-gateway dev
- REDIS_URL=redis://localhost:6379 JWT_ACCESS_SECRET=... REALTIME_HTTP_PORT=4001
- Health check: GET /health on the same HTTP port.
*/

import http from "node:http";
import { URL } from "node:url";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import { WebSocketServer, WebSocket } from "ws";
import { parseClientMessage, parseDeltaMessage } from "./messages.js";

const CHANNEL = "planet:deltas";
const DEFAULT_PORT = 4001;
const HEARTBEAT_INTERVAL_MS = 30_000;

interface AuthenticatedSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
  rooms: Set<string>;
}

function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`${name} is required`);
}

function getPort(): number {
  const value = process.env.REALTIME_HTTP_PORT ?? process.env.REALTIME_PORT ?? process.env.PORT;
  const port = Number(value ?? DEFAULT_PORT);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
}

function authenticate(requestUrl: string | undefined): { sub?: string } {
  const secret = env("JWT_ACCESS_SECRET");
  const url = new URL(requestUrl ?? "/", "http://localhost");
  const token = url.searchParams.get("token");

  if (!token) {
    throw new Error("Missing token");
  }

  const payload = jwt.verify(token, secret);
  if (typeof payload === "string") {
    throw new Error("Invalid token payload");
  }

  if (payload.type !== undefined && payload.type !== "access") {
    throw new Error("Invalid token type");
  }

  return { sub: typeof payload.sub === "string" ? payload.sub : undefined };
}

const port = getPort();
const redisUrl = env("REDIS_URL", "redis://localhost:6379");
const subscriber = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

let redisConnected = false;

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/health")) {
    const body = JSON.stringify({
      status: "ok",
      service: "realtime-gateway",
      redis: redisConnected ? "connected" : "disconnected",
      clients: wss.clients.size,
    });

    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  let user: { sub?: string };
  try {
    user = authenticate(request.url);
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const client = ws as AuthenticatedSocket;
    client.isAlive = true;
    client.userId = user.sub;
    client.rooms = new Set();
    wss.emit("connection", client, request);
  });
});

wss.on("connection", (client: AuthenticatedSocket) => {
  client.on("pong", () => {
    client.isAlive = true;
  });

  client.on("message", (raw) => {
    try {
      const message = parseClientMessage(raw);
      if (message.type === "subscribe") {
        client.rooms.add(message.planetId);
        client.send(JSON.stringify({ type: "subscribed", planetId: message.planetId }));
      } else {
        client.rooms.delete(message.planetId);
        client.send(JSON.stringify({ type: "unsubscribed", planetId: message.planetId }));
      }
    } catch (error) {
      client.send(
        JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Invalid message",
        }),
      );
    }
  });
});

subscriber.on("error", (error: Error) => {
  redisConnected = false;
  console.warn(`Redis subscriber error: ${error.message}`);
});

subscriber.on("connect", () => {
  redisConnected = true;
});

subscriber.on("end", () => {
  redisConnected = false;
});

subscriber.on("message", (_channel: string, raw: string) => {
  let delta;
  try {
    delta = parseDeltaMessage(raw);
  } catch (error) {
    console.warn(`Skipping invalid delta: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const outbound = JSON.stringify({ type: "delta", delta });
  for (const socket of wss.clients) {
    const client = socket as AuthenticatedSocket;
    if (client.readyState === WebSocket.OPEN && client.rooms.has(delta.planetId)) {
      client.send(outbound);
    }
  }
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    const client = socket as AuthenticatedSocket;
    if (!client.isAlive) {
      client.terminate();
      continue;
    }

    client.isAlive = false;
    client.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

async function start() {
  await subscriber.connect();
  await subscriber.subscribe(CHANNEL);
  server.listen(port, () => {
    console.log(`Realtime gateway listening on :${port}`);
  });
}

async function shutdown() {
  clearInterval(heartbeat);
  await subscriber.quit().catch(() => undefined);
  wss.close();
  server.close();
}

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

void start().catch((error) => {
  console.error(error);
  process.exit(1);
});
