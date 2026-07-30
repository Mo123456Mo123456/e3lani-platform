import type {
  ContributionAnalysis,
  PlanetRegion,
  WorldEvent,
} from "@planet/shared-types";

export interface SimulatedEntity {
  id: string;
  kind: "civilization" | "species" | "plant" | "resource" | "city";
  name: string;
  regionId: string;
  population: number;
  health: number;
  attributes: Record<string, number | string | boolean>;
}

export interface ContributionRecord {
  id: string;
  userId: string;
  regionId: string;
  analysis: ContributionAnalysis;
  createdAtTick: number;
  active: boolean;
}

export interface CausalEdge {
  sourceEventId: string;
  targetEventId: string;
  relation: "caused" | "amplified" | "enabled" | "mitigated";
  strength: number;
  explanation: string;
}

export interface WorldState {
  id: string;
  nameAr: string;
  nameEn: string;
  seed: string;
  currentTick: number;
  currentYear: number;
  tickDuration: "day" | "month" | "year" | "decade";
  running: boolean;
  regions: PlanetRegion[];
  entities: SimulatedEntity[];
  contributions: ContributionRecord[];
  events: WorldEvent[];
  causalEdges: CausalEdge[];
  nextSequence: number;
}

export interface WorldSnapshot {
  tick: number;
  sequence: number;
  stateHash: string;
  state: WorldState;
}
