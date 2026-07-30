import { EventEmitter } from "node:events";
import {
  JSONCodec,
  connect,
  type NatsConnection,
  type Subscription,
} from "nats";

export type WorldDelta = {
  type: "contribution.committed" | "simulation.paused" | "simulation.resumed" | "timeline.rolled_back";
  planetId: string;
  tick: number;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export interface EventBus {
  readonly kind: "in-process" | "nats";
  publish(topic: string, event: WorldDelta): Promise<void>;
  subscribe(topic: string, handler: (event: WorldDelta) => void): () => void;
  close(): Promise<void>;
}

export class InProcessEventBus implements EventBus {
  readonly kind = "in-process" as const;
  private readonly emitter = new EventEmitter();

  async publish(topic: string, event: WorldDelta) {
    this.emitter.emit(topic, structuredClone(event));
  }

  subscribe(topic: string, handler: (event: WorldDelta) => void) {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }

  async close() {
    this.emitter.removeAllListeners();
  }
}

export class NatsEventBus implements EventBus {
  readonly kind = "nats" as const;
  private readonly codec = JSONCodec<WorldDelta>();
  private readonly subscriptions = new Set<Subscription>();

  private constructor(private readonly connection: NatsConnection) {}

  static async connect(servers: string): Promise<NatsEventBus> {
    const connection = await connect({ servers, name: "planet-api" });
    return new NatsEventBus(connection);
  }

  async publish(topic: string, event: WorldDelta) {
    this.connection.publish(topic, this.codec.encode(event));
  }

  subscribe(topic: string, handler: (event: WorldDelta) => void) {
    const subscription = this.connection.subscribe(topic);
    this.subscriptions.add(subscription);
    void (async () => {
      for await (const message of subscription) {
        try {
          handler(this.codec.decode(message.data));
        } catch {
          // Invalid cross-service messages are isolated from the subscriber loop.
        }
      }
    })();
    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(subscription);
    };
  }

  async close() {
    for (const subscription of this.subscriptions) subscription.unsubscribe();
    await this.connection.drain();
  }
}

export async function createEventBus(natsUrl?: string): Promise<EventBus> {
  return natsUrl ? NatsEventBus.connect(natsUrl) : new InProcessEventBus();
}
