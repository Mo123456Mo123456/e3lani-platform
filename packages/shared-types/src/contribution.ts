import type { BiomeType, ContributionCategory, ContributionStatus } from "./enums.js";
import type { GeoPoint } from "./world.js";

/**
 * Normalised trait bag produced by the AI parse step and validated by the
 * balance layer. All values are 0..1 unless noted.
 */
export interface ContributionTraits {
  size?: number;
  growthRate?: number;
  reproductionRate?: number;
  lifespan?: number;
  waterNeed?: number;
  heatResistance?: number;
  coldResistance?: number;
  pollutionAbsorption?: number;
  pollutionEmission?: number;
  energyStorage?: number;
  energyOutput?: number;
  luminosity?: number;
  toxicity?: number;
  spreadRate?: number;
  intelligence?: number;
  aggression?: number;
  mobility?: number;
  adaptability?: number;
  mutationRate?: number;
  contagiousness?: number;
  lethality?: number;
  scarcity?: number;
  renewalRate?: number;
  value?: number;
  influence?: number;
  /** world_law only: multiplier targets e.g. warProbability */
  warProbabilityMultiplier?: number;
  climateSensitivityMultiplier?: number;
  [key: string]: number | undefined;
}

export interface ParsedContribution {
  category: ContributionCategory;
  name: string;
  description: string;
  traits: ContributionTraits;
  possibleBiomes: BiomeType[];
  risks: string[];
  benefits: string[];
}

export interface BalanceIssue {
  code:
    | "TRAIT_OVER_CAP"
    | "TRAIT_BUDGET_EXCEEDED"
    | "FORBIDDEN_COMBINATION"
    | "IMMORTALITY"
    | "INSTANT_PLANET_KILL"
    | "UNBOUNDED_ENERGY"
    | "ABSOLUTE_CONTROL"
    | "EMPTY_TRAITS";
  message: string;
  trait?: string;
}

export interface BalanceResult {
  acceptable: boolean;
  issues: BalanceIssue[];
  /** balanced suggestion when the raw parse is too strong */
  adjusted: ParsedContribution;
  adjustments: string[];
}

export interface SuitabilityCell {
  index: number;
  lat: number;
  lon: number;
  score: number;
}

export interface ContributionPreview {
  parsed: ParsedContribution;
  balance: BalanceResult;
  suggestedOrigin: SuitabilityCell[];
  successProbability: number;
  expectedShortTerm: string[];
  expectedLongTerm: string[];
  affectedCivsLikely: number;
}

export interface Contribution {
  id: string;
  userId: string;
  planetId: string;
  category: ContributionCategory;
  rawText: string;
  parsed: ParsedContribution;
  origin: GeoPoint & { index: number };
  status: ContributionStatus;
  createdTick: number;
  createdAt: string;
  rootEventId: string | null;
  impactScore: number;
  eventCount: number;
  /** true when analysed by the deterministic sandbox provider */
  sandbox: boolean;
}

export interface ScenarioHorizonReport {
  yearsAhead: number;
  targetTick: number;
  runs: number;
  /** most probable outcome band */
  mostLikely: string;
  bestCase: string;
  worstCase: string;
  /** 0..1 — higher means outcomes diverge more */
  uncertainty: number;
  /** factors that most changed outcomes across runs */
  drivers: string[];
  scoreDistribution: { p10: number; p50: number; p90: number };
}

export interface ScenarioReport {
  contributionId: string;
  horizons: ScenarioHorizonReport[];
  generatedAtTick: number;
}
