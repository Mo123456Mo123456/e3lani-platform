import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { WorldEvent } from "@planet/shared-types";
import { verifyAccessToken } from "../auth/jwt.util";

/**
 * Realtime gateway (Socket.IO). Clients authenticate with the access
 * token, join a personal room, then subscribe to planet rooms.
 * All pushes are delta events — never full world state.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger("RealtimeGateway");
  private connections = 0;

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth as Record<string, unknown>)?.token ??
      client.handshake.headers.authorization?.replace(/^Bearer /, "");
    if (!token || typeof token !== "string") {
      client.disconnect(true);
      return;
    }
    try {
      const claims = await verifyAccessToken(token);
      client.data.userId = claims.sub;
      client.data.role = claims.role;
      await client.join(`user:${claims.sub}`);
      this.connections += 1;
      client.emit("session:ready", { userId: claims.sub });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    this.connections = Math.max(0, this.connections - 1);
  }

  @SubscribeMessage("subscribe:planet")
  async subscribePlanet(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { planetId?: string },
  ): Promise<void> {
    if (body?.planetId && typeof body.planetId === "string" && body.planetId.length < 64) {
      await client.join(`planet:${body.planetId}`);
    }
  }

  @SubscribeMessage("unsubscribe:planet")
  async unsubscribePlanet(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { planetId?: string },
  ): Promise<void> {
    if (body?.planetId) {
      await client.leave(`planet:${body.planetId}`);
    }
  }

  activeConnections(): number {
    return this.connections;
  }

  emitToPlanet(planetId: string, event: string, payload: unknown): void {
    this.server.to(`planet:${planetId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  broadcastWorldEvent(planetId: string, worldEvent: WorldEvent): void {
    this.emitToPlanet(planetId, "event:new", { planetId, event: worldEvent });
  }

  broadcastTick(planetId: string, tick: number, hash: string): void {
    this.emitToPlanet(planetId, "planet:tick", { planetId, tick, hash });
  }
}
