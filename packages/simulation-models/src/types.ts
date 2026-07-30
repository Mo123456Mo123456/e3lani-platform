export type Biome =
  | "ocean"
  | "coast"
  | "plains"
  | "rainforest"
  | "temperate_forest"
  | "desert"
  | "mountain"
  | "tundra"
  | "wetland"
  | "steppe"
  | "volcanic"
  | "ice";

export type ContributionCategory =
  | "creature"
  | "plant"
  | "resource"
  | "civilization"
  | "invention"
  | "phenomenon"
  | "disease"
  | "culture"
  | "law"
  | "custom";

export type WorldEventKind =
  | "WORLD_CREATED"
  | "SPECIES_CREATED"
  | "SPECIES_EXTINCT"
  | "CIVILIZATION_FOUNDED"
  | "TECHNOLOGY_DISCOVERED"
  | "WAR_STARTED"
  | "WAR_ENDED"
  | "MIGRATION_STARTED"
  | "ALLIANCE_CREATED"
  | "DISEASE_OUTBREAK"
  | "CLIMATE_CHANGED"
  | "VOLCANO_ERUPTED"
  | "RESOURCE_DISCOVERED"
  | "RESOURCE_DEPLETED"
  | "TRADE_ROUTE_CREATED"
  | "CONTRIBUTION_INTRODUCED"
  | "CONTRIBUTION_SPREAD";

export interface Region {
  id: string;
  nameAr: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  elevation: number;
  moisture: number;
  temperature: number;
  fertility: number;
  pollution: number;
  population: number;
  carryingCapacity: number;
  biome: Biome;
  resourceScore: number;
  civilizationId: string | null;
}

export interface Civilization {
  id: string;
  nameAr: string;
  nameEn: string;
  capitalRegionId: string;
  population: number;
  technology: number;
  economy: number;
  stability: number;
  military: number;
  pollution: number;
}

export interface ContributionTraits {
  size: number;
  growthRate: number;
  waterNeed: number;
  pollutionAbsorption: number;
  nightLuminosity: number;
  coldResistance: number;
  heatResistance: number;
  adaptability: number;
  aggression: number;
  economicValue: number;
}

export interface ContributionAnalysis {
  provider: "sandbox" | "openai" | "anthropic" | "gemini" | "local";
  category: ContributionCategory;
  name: string;
  summary: string;
  traits: ContributionTraits;
  possibleBiomes: Biome[];
  benefits: string[];
  risks: string[];
  balanceAdjustments: string[];
  confidence: number;
}

export interface Contribution {
  id: string;
  ownerId: string;
  createdAtTick: number;
  originRegionId: string;
  sourceText: string;
  analysis: ContributionAnalysis;
  spreadRegionIds: string[];
  environmentalImpact: number;
  economicImpact: number;
}

export interface CausalLink {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  strength: number;
}

export interface WorldEvent {
  id: string;
  kind: WorldEventKind;
  tick: number;
  year: number;
  regionId: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  importance: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  causeIds: string[];
  contributionId: string | null;
  directImpact: Record<string, number>;
}

export interface WorldMetrics {
  temperature: number;
  pollution: number;
  biodiversity: number;
  population: number;
  civilizations: number;
  resources: number;
}

export interface WorldState {
  version: 1;
  seed: number;
  tick: number;
  year: number;
  regions: Region[];
  civilizations: Civilization[];
  contributions: Contribution[];
  events: WorldEvent[];
  causalLinks: CausalLink[];
  metrics: WorldMetrics;
}

export interface WorldSnapshot {
  id: string;
  tick: number;
  year: number;
  createdAt: string;
  state: WorldState;
}

export interface SimulationDelta {
  tick: number;
  year: number;
  changedRegionIds: string[];
  events: WorldEvent[];
  metrics: WorldMetrics;
}

export interface SimulationResult {
  state: WorldState;
  delta: SimulationDelta;
}

export interface FutureScenario {
  horizonYears: number;
  label: "most_likely" | "best_case" | "worst_case";
  probability: number;
  uncertainty: number;
  environmentalImpact: number;
  economicImpact: number;
  spreadRegions: number;
  factors: string[];
}
