/** User contribution contract (multi-step wizard). */

export const CONTRIBUTION_CATEGORIES = [
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "natural_phenomenon",
  "disease",
  "culture",
  "world_law",
  "custom",
] as const;
export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number];

export interface StructuredContribution {
  category: ContributionCategory;
  name: string;
  description?: string | null;
  traits: Record<string, number | string>;
  possibleBiomes: string[];
  risks: string[];
  provider: string;
  sandbox: boolean;
}

export type ContributionStatus =
  | "draft"
  | "analyzing"
  | "analyzed"
  | "previewing"
  | "previewed"
  | "confirming"
  | "applied"
  | "rejected"
  | "failed";

export interface ContributionAssessment {
  successProbability: number;
  fitAtTarget: number;
  suitableBiomes: Array<{ biome: string; fit: number }>;
  risks: string[];
  shortTerm: { spreadLikelihood: number; expectedEvents: string[]; horizon: string };
  longTerm: { spreadLikelihood: number; expectedEvents: string[]; horizon: string };
}

export interface BalanceReportDto {
  verdict: "ok" | "adjusted" | "rejected";
  issues: Array<Record<string, unknown>>;
  suggested: StructuredContribution | null;
  provider: string;
  sandbox: boolean;
}

export interface CausalGraphDto {
  nodes: Array<{
    id: string;
    kind: "contribution" | "primary" | "secondary" | "longterm" | "event";
    label: string;
    horizon: string;
    strength: number;
    mechanism: string | null;
  }>;
  edges: Array<{ source: string; target: string; sign: "+" | "-"; mechanism: string }>;
  note: string;
}

export interface ScenarioHorizon {
  years: number;
  ticksSimulated: number;
  yearsPerTick: number;
  mostLikely: ScenarioMetrics;
  best: ScenarioMetrics;
  worst: ScenarioMetrics;
  mean: Record<string, number>;
  uncertainty: number;
  drivers: Array<{ factor: string; runsAffected: number; habitabilityDelta: number | null }>;
}

export interface ScenarioMetrics {
  population: number;
  civsAlive: number;
  speciesAlive: number;
  plantsAlive: number;
  warsStarted: number;
  extinctions: number;
  collapses: number;
  foundings: number;
  pollution: number;
  tempShift: number;
  contributionEvents: number;
  habitability: number;
}

export interface ScenarioReport {
  baseTick: number;
  runs: number;
  contributionId: string | null;
  horizons: ScenarioHorizon[];
  probabilistic: boolean;
}

export interface UserContributionDto {
  id: string;
  userId: string;
  planetId: string;
  category: ContributionCategory;
  name: string;
  status: ContributionStatus;
  traits: Record<string, number | string>;
  targetCellId: number | null;
  appliedTick: number | null;
  provider: string | null;
  sandbox: boolean;
  impact: {
    descendantEvents: number;
    affectedCivs: number;
    affectedCells: number;
    lastEventAt: number | null;
  };
  createdAt: string;
}

export interface ContributionImpact {
  contribution: UserContributionDto;
  descendantEvents: Array<{
    id: string;
    tick: number;
    type: string;
    importance: number;
    cellId: number | null;
  }>;
  spreadCells: number[];
  affectedCivIds: string[];
}
