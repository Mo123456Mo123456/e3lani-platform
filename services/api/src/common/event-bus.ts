import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { WorldDelta, WorldEvent } from "@kawkab/shared-types";

export interface BusTopics {
  "world.delta": { planetId: string; delta: WorldDelta };
  "world.event": { planetId: string; event: WorldEvent };
  "contribution.applied": { planetId: string; contributionId: string; userId: string; rootEventId: string | null };
  "simulation.status": { planetId: string; running: boolean; tick: number };
}

type Handler<T> = (payload: T) => void;

/**
 * In-process event bus (NATS JetStream adapter boundary).
 * The bus interface is deliberately minimal so a JetStream/Redis Streams
 * adapter can replace it in multi-instance deployments without touching
 * producers or consumers (see docs/architecture.md, ADR-004).
 */
@Injectable()
export class EventBus implements OnModuleDestroy {
  private readonly logger = new Logger(EventBus.name);
  private readonly handlers = new Map<string, Set<Handler<never>>>();

  publish<K extends keyof BusTopics>(topic: K, payload: BusTopics[K]): void {
    const set = this.handlers.get(topic as string);
    if (!set) return;
    for (const handler of set) {
      try {
        (handler as Handler<BusTopics[K]>)(payload);
      } catch (err) {
        this.logger.error(`handler error on ${String(topic)}: ${String(err)}`);
      }
    }
  }

  subscribe<K extends keyof BusTopics>(topic: K, handler: Handler<BusTopics[K]>): () => void {
    const set = this.handlers.get(topic as string) ?? new Set();
    set.add(handler as Handler<never>);
    this.handlers.set(topic as string, set);
    return () => set.delete(handler as Handler<never>);
  }

  onModuleDestroy(): void {
    this.handlers.clear();
  }
}
