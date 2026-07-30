import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type {
  CommitContributionRequest,
  RealtimeServerEvent,
  WorldEvent,
} from "@planet/shared-types";
import {
  addContribution,
  advanceWorld,
  deterministicUuid,
  generateWorld,
  summarizeWorld,
  type ContributionResult,
  type TickResult,
  type WorldState,
} from "@planet/simulation-models";
import { Subject } from "rxjs";

import { WorldRepository } from "./world.repository";

export const SANDBOX_USER_ID = deterministicUuid("sandbox", "super-admin");

@Injectable()
export class WorldService implements OnModuleInit {
  readonly realtime$ = new Subject<RealtimeServerEvent>();
  private world!: WorldState;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly repository: WorldRepository) {}

  async onModuleInit(): Promise<void> {
    const initial = generateWorld({
      seed: process.env.WORLD_SEED ?? "nova-terra-production-seed-v1",
      regionCount: Number(process.env.WORLD_REGION_COUNT ?? 512),
    });
    this.world = await this.repository.initialize(initial);
    if (this.repository.mode === "memory-sandbox" && this.world.events.length === 1) {
      this.world = advanceWorld(this.world, 240).world;
    }
  }

  getSummary() {
    return {
      ...summarizeWorld(this.world),
      persistenceMode: this.repository.mode,
    };
  }

  getRegions(worldId: string) {
    this.assertWorld(worldId);
    return this.world.regions;
  }

  getEvents(worldId: string, limit = 80, before?: number): WorldEvent[] {
    this.assertWorld(worldId);
    const boundedLimit = Math.min(200, Math.max(1, limit));
    return this.world.events
      .filter((event) => before === undefined || event.sequence < before)
      .slice(-boundedLimit)
      .reverse();
  }

  getCausality(worldId: string, contributionId: string) {
    this.assertWorld(worldId);
    const events = this.world.events.filter(
      (event) => event.contributionId === contributionId,
    );
    const eventIds = new Set(events.map(({ id }) => id));
    return {
      contributionId,
      nodes: events,
      edges: this.world.causalEdges.filter(
        ({ sourceEventId, targetEventId }) =>
          eventIds.has(sourceEventId) || eventIds.has(targetEventId),
      ),
    };
  }

  runTicks(worldId: string, count: number): Promise<TickResult> {
    this.assertWorld(worldId);
    return this.exclusive(async () => {
      const result = advanceWorld(this.world, count);
      await this.repository.persist(result.world, result.events);
      this.world = result.world;
      for (const event of result.events) {
        this.realtime$.next({ kind: "world.event", data: event });
      }
      const summary = summarizeWorld(this.world);
      this.realtime$.next({
        kind: "world.tick",
        data: {
          id: summary.id,
          currentTick: summary.currentTick,
          currentYear: summary.currentYear,
          stateHash: summary.stateHash,
        },
      });
      return result;
    });
  }

  addContribution(
    worldId: string,
    userId: string,
    request: CommitContributionRequest,
  ): Promise<ContributionResult> {
    this.assertWorld(worldId);
    return this.exclusive(async () => {
      const result = addContribution(this.world, userId, request);
      await this.repository.persist(result.world, result.events);
      this.world = result.world;
      for (const event of result.events) {
        this.realtime$.next({ kind: "world.event", data: event });
      }
      this.realtime$.next({
        kind: "contribution.status",
        data: {
          contributionId: result.contribution.id,
          status: "committed",
        },
      });
      return result;
    });
  }

  private assertWorld(worldId: string): void {
    if (worldId !== this.world.id) {
      throw new NotFoundException("World not found");
    }
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(operation, operation);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
