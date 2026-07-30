import { connect, JSONCodec, type NatsConnection } from "@nats-io/transport-node";
import type { WorldDelta, WorldEvent } from "@planet/shared-types";

export class EventBus {
  private connection: NatsConnection | null = null;
  private readonly codec = JSONCodec();

  constructor(private readonly url: string) {}

  async connect(required: boolean): Promise<void> {
    try {
      this.connection = await connect({
        servers: this.url,
        name: "planet-api",
        maxReconnectAttempts: -1,
      });
    } catch (error) {
      if (required) throw error;
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "NATS unavailable; local WebSocket delivery remains active",
        }),
      );
    }
  }

  publishEvents(events: WorldEvent[]): void {
    if (!this.connection) return;
    for (const event of events) {
      this.connection.publish(`world.events.${event.type.toLowerCase()}`, this.codec.encode(event));
    }
  }

  publishDelta(delta: WorldDelta): void {
    this.connection?.publish("world.delta", this.codec.encode(delta));
  }

  async close(): Promise<void> {
    await this.connection?.drain();
  }
}
