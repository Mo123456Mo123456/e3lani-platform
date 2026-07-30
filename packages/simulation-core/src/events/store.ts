import type { WorldEventType } from "@planet/shared-types";

export interface SimEvent {
  id: string;
  type: WorldEventType;
  tick: number;
  year: number;
  regionId: string | null;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  importance: number;
  cause: string | null;
  relatedEntityIds: string[];
  contributionId?: string | null;
  directImpact: Record<string, number>;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface CausalEdge {
  id: string;
  causeEventId: string;
  effectEventId: string;
  relation: string;
  strength: number;
  delayTicks: number;
}

export class EventStore {
  private events: SimEvent[] = [];
  private edges: CausalEdge[] = [];

  append(event: SimEvent, causedBy?: { eventId: string; relation: string; strength?: number; delayTicks?: number }): void {
    this.events.push(event);
    if (causedBy) {
      this.edges.push({
        id: `edge_${this.edges.length}_${event.id}`,
        causeEventId: causedBy.eventId,
        effectEventId: event.id,
        relation: causedBy.relation,
        strength: causedBy.strength ?? 0.7,
        delayTicks: causedBy.delayTicks ?? 0,
      });
    }
  }

  all(): readonly SimEvent[] {
    return this.events;
  }

  edgesAll(): readonly CausalEdge[] {
    return this.edges;
  }

  byTick(tick: number): SimEvent[] {
    return this.events.filter((e) => e.tick === tick);
  }

  since(tick: number): SimEvent[] {
    return this.events.filter((e) => e.tick >= tick);
  }

  snapshot(): { events: SimEvent[]; edges: CausalEdge[] } {
    return {
      events: structuredClone(this.events),
      edges: structuredClone(this.edges),
    };
  }

  restore(snap: { events: SimEvent[]; edges: CausalEdge[] }): void {
    this.events = structuredClone(snap.events);
    this.edges = structuredClone(snap.edges);
  }

  clear(): void {
    this.events = [];
    this.edges = [];
  }
}

let eventCounter = 0;
export function makeEventId(prefix = "evt"): string {
  eventCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${eventCounter}`;
}

export function resetEventCounter(n = 0): void {
  eventCounter = n;
}
