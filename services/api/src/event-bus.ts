import { connect, type NatsConnection } from "@nats-io/transport-node";
import type { WorldDelta, WorldEvent } from "@planet/shared-types";

export class EventBus {
  private connection: NatsConnection | null = null;
  private readonly encoder = new TextEncoder();

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
      this.connection.publish(
        `world.events.${event.type.toLowerCase()}`,
        this.encoder.encode(JSON.stringify(event)),
      );
    }
  }

  publishDelta(delta: WorldDelta): void {
    this.connection?.publish(
      "world.delta",
      this.encoder.encode(JSON.stringify(delta)),
    );
  }

  async close(): Promise<void> {
    await this.connection?.drain();
  }
}
