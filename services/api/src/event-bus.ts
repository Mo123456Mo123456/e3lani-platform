import { connect, JSONCodec, type NatsConnection } from "nats";
import type { DeltaResult } from "./world-repository.js";

export class WorldEventBus {
  private connection?: NatsConnection;
  private readonly codec = JSONCodec();

  async connect(): Promise<void> {
    const servers = process.env.NATS_URL;
    if (!servers) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("NATS_URL is required in production");
      }
      return;
    }
    this.connection = await connect({
      servers,
      name: "living-planet-api",
      reconnect: true,
      maxReconnectAttempts: -1,
    });
  }

  async publish(result: DeltaResult): Promise<void> {
    if (!this.connection) return;
    this.connection.publish(
      "world.delta",
      this.codec.encode({
        planetId: result.state.planetId,
        version: result.state.version,
        tick: result.state.tick,
        events: result.events,
        changedRegionIds: result.changedRegionIds,
      }),
    );
    for (const event of result.events) {
      this.connection.publish(`world.event.${event.type.toLowerCase()}`, this.codec.encode(event));
    }
    await this.connection.flush();
  }

  async close(): Promise<void> {
    await this.connection?.drain();
  }
}
