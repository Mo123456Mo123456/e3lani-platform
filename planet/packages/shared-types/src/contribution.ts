import type { ContributionCategory } from "./enums.js";

/**
 * Structured traits produced by the AI analysis layer (or the mock
 * provider) from free-form user text. All values are normalized 0..1.
 * This is the contract validated by @planet/validation before the
 * simulation engine accepts an addition.
 */
export interface AnalyzedTraits {
  size: number;
  growthRate: number;
  waterNeed: number;
  energyOutput: number;
  pollutionAbsorption: number;
  pollutionEmission: number;
  coldResistance: number;
  heatResistance: number;
  aggression: number;
  intelligence: number;
  reproductionRate: number;
  lifespan: number;
  adaptability: number;
  rarity: number;
  nightLuminosity: number;
  toxicity: number;
  spreadRate: number;
}

export interface AnalyzedContribution {
  category: ContributionCategory;
  name: string;
  summary: string;
  traits: AnalyzedTraits;
  possibleBiomes: string[];
  risks: string[];
  benefits: string[];
  /** True when produced by a sandbox/mock provider, never in production with real keys. */
  sandbox: boolean;
}

export interface BalanceResult {
  verdict: "accept" | "adjust" | "reject";
  reasons: string[];
  adjustedTraits?: AnalyzedTraits;
  suggestions?: string[];
}

/** One horizon of the Monte-Carlo future preview. */
export interface ScenarioHorizon {
  years: number;
  /** 0..1 probability mass of the most likely branch. */
  likelihood: number;
  uncertainty: number;
  summary: ScenarioSummary;
  best: ScenarioSummary;
  worst: ScenarioSummary;
  keyFactors: string[];
}

export interface ScenarioSummary {
  biosphereHealth: number;
  civProsperity: number;
  pollution: number;
  population: number;
  notableEvents: { type: string; count: number }[];
}

export interface ContributionPreview {
  successProbability: number;
  suitableBiomes: string[];
  environmentalImpact: number;
  economicImpact: number;
  risks: string[];
  beneficiaryCivs: string[];
  horizons: ScenarioHorizon[];
}

export interface ContributionDTO {
  id: string;
  userId: string;
  worldId: string;
  category: ContributionCategory;
  rawText: string;
  status: string;
  analysis?: AnalyzedContribution;
  preview?: ContributionPreview;
  cellIndex?: number;
  appliedTick?: number;
  impactScore: number;
  eventCount: number;
  createdAt: string;
}
