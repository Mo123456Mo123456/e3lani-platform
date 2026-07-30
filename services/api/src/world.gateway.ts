import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { RealtimeServerEvent } from "@planet/shared-types";
import type { Server, Socket } from "socket.io";
import type { Subscription } from "rxjs";

import { AuthService } from "./auth.service";
import { WorldService } from "./world.service";

@Injectable()
@WebSocketGateway({
  namespace: "/world",
  cors: {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  },
  transports: ["websocket"],
  maxHttpBufferSize: 64 * 1_024,
})
export class WorldGateway
  implements OnGatewayConnection, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private subscription?: Subscription;

  constructor(
    private readonly worlds: WorldService,
    private readonly auth: AuthService,
  ) {}

  afterInit(): void {
    this.subscription = this.worlds.realtime$.subscribe((event) => {
      this.server.emit("delta", event satisfies RealtimeServerEvent);
    });
  }

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    const token =
      typeof client.handshake.auth.token === "string"
        ? client.handshake.auth.token
        : undefined;
    try {
      await this.auth.authenticate(token ? `Bearer ${token}` : undefined);
      client.emit("ready", {
        world: this.worlds.getSummary(),
        protocolVersion: 1,
        updateMode: "delta",
      });
    } catch {
      client.disconnect(true);
    }
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
