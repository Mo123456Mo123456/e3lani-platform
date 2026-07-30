import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { WebSocketServer, type WebSocket } from "ws";
import type { RealtimeMessage } from "@planet/shared-types";
import { AuthService } from "../auth/auth.service.js";

interface ClientState {
  socket: WebSocket;
  userId: string;
  worlds: Set<string>;
}

/**
 * Realtime gateway (raw WebSocket, no socket.io dependency).
 *
 * Protocol:
 *   connect:  ws://host/realtime?token=<accessToken>
 *   client →  {"action":"subscribe","worldId":"..."} | {"action":"unsubscribe",...}
 *   server →  RealtimeMessage deltas (never a full world resend)
 */
@Injectable()
export class RealtimeGateway implements OnModuleDestroy {
  private server: WebSocketServer | null = null;
  private clients = new Set<ClientState>();

  constructor(private auth: AuthService) {}

  attach(server: import("node:http").Server): void {
    this.server = new WebSocketServer({ server, path: "/realtime" });
    this.server.on("connection", (socket, req) => this.onConnection(socket, req.url ?? ""));
  }

  onModuleDestroy(): void {
    this.server?.close();
  }

  private onConnection(socket: WebSocket, url: string): void {
    try {
      const token = new URL(url, "http://localhost").searchParams.get("token") ?? "";
      const payload = this.auth.verifyAccess(token);
      const state: ClientState = { socket, userId: payload.sub, worlds: new Set() };
      this.clients.add(state);
      socket.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as { action?: string; worldId?: string };
          if (msg.action === "subscribe" && msg.worldId) state.worlds.add(msg.worldId);
          if (msg.action === "unsubscribe" && msg.worldId) state.worlds.delete(msg.worldId);
        } catch {
          // Malformed client messages are ignored, never fatal.
        }
      });
      socket.on("close", () => this.clients.delete(state));
      socket.on("error", () => this.clients.delete(state));
      socket.send(JSON.stringify({ kind: "connected", userId: payload.sub }));
    } catch {
      socket.close(4401, "unauthorized");
    }
  }

  broadcastToWorld(worldId: string, message: RealtimeMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.worlds.has(worldId) && client.socket.readyState === client.socket.OPEN) {
        client.socket.send(data);
      }
    }
  }

  sendToUser(userId: string, message: RealtimeMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.userId === userId && client.socket.readyState === client.socket.OPEN) {
        client.socket.send(data);
      }
    }
  }

  connectionCount(): number {
    return this.clients.size;
  }
}
