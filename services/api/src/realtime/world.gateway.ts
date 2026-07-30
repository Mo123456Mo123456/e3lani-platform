import { Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, WebSocket } from "ws";
import type { WorldDelta, WorldEvent } from "@kawkab/shared-types";
import { verifyWsToken } from "../common/guards.js";
import { EventBus } from "../common/event-bus.js";
import { WorldManager } from "../worlds/world-manager.js";

interface ClientState {
  socket: WebSocket;
  userId: string | null;
  planets: Set<string>;
  alive: boolean;
}

type ClientMessage =
  | { type: "subscribe"; planetId: string; token?: string }
  | { type: "unsubscribe"; planetId: string }
  | { type: "ping" };

/**
 * Realtime gateway: clients subscribe to a planet and receive delta updates —
 * never the full world state (spec: delta updates only).
 */
@WebSocketGateway({ path: "/ws" })
export class WorldGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorldGateway.name);
  private readonly clients = new Set<ClientState>();
  private heartbeat: NodeJS.Timeout | null = null;
  private unsubscribe: Array<() => void> = [];

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly bus: EventBus,
    private readonly jwt: JwtService,
    private readonly manager: WorldManager,
  ) {}

  onModuleInit(): void {
    this.server.on("connection", (socket: WebSocket) => this.onConnection(socket));
    this.unsubscribe.push(
      this.bus.subscribe("world.delta", ({ planetId, delta }) => this.broadcast(planetId, { type: "delta", delta })),
      this.bus.subscribe("world.event", ({ planetId, event }) => this.broadcastEvent(planetId, event)),
      this.bus.subscribe("simulation.status", ({ planetId, running, tick }) => this.broadcast(planetId, { type: "status", running, tick })),
    );
    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          client.socket.terminate();
          this.clients.delete(client);
          continue;
        }
        client.alive = false;
        client.socket.ping();
      }
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const u of this.unsubscribe) u();
  }

  private onConnection(socket: WebSocket): void {
    const state: ClientState = { socket, userId: null, planets: new Set(), alive: true };
    this.clients.add(state);
    socket.on("pong", () => (state.alive = true));
    socket.on("message", (raw: Buffer) => {
      void this.onMessage(state, raw.toString()).catch((err) => this.logger.warn(`ws message error: ${String(err)}`));
    });
    socket.on("close", () => this.clients.delete(state));
    socket.on("error", () => this.clients.delete(state));
    this.send(socket, { type: "hello", version: 1 });
  }

  private async onMessage(state: ClientState, raw: string): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "ping":
        this.send(state.socket, { type: "pong", t: Date.now() });
        return;
      case "subscribe": {
        if (msg.token && !state.userId) {
          const user = await verifyWsToken(this.jwt, msg.token);
          state.userId = user?.id ?? null;
        }
        state.planets.add(msg.planetId);
        const engine = this.manager.get(msg.planetId);
        this.send(state.socket, {
          type: "subscribed",
          planetId: msg.planetId,
          tick: engine?.state.tick ?? null,
          stats: engine?.getStats() ?? null,
        });
        return;
      }
      case "unsubscribe":
        state.planets.delete(msg.planetId);
        return;
    }
  }

  private broadcast(planetId: string, payload: unknown): void {
    const data = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.planets.has(planetId) && client.socket.readyState === 1) {
        client.socket.send(data);
      }
    }
  }

  /** important events go out individually so the live feed reacts instantly */
  private broadcastEvent(planetId: string, event: WorldEvent): void {
    if (event.magnitude < 0.4) return;
    this.broadcast(planetId, { type: "event", event });
  }

  private send(socket: WebSocket, payload: unknown): void {
    if (socket.readyState === 1) socket.send(JSON.stringify(payload));
  }
}
