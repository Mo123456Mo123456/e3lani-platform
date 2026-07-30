import type {
  Biome,
  ContributionCategory,
  Role,
  WorldEventType,
} from "@planet/config";

export type { Biome, ContributionCategory, Role, WorldEventType };

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RegionRef {
  id: string;
  name: string;
  biome: Biome;
  lat: number;
  lng: number;
}

export interface TraitMap {
  [key: string]: number;
}

export interface StructuredContribution {
  category: ContributionCategory;
  name: string;
  nameEn?: string;
  description: string;
  traits: TraitMap;
  possibleBiomes: Biome[];
  risks: string[];
  benefits: string[];
  balanceNotes: string[];
  wasBalanced: boolean;
  originalIdea: string;
}

export interface CausalNode {
  id: string;
  label: string;
  kind: "cause" | "direct" | "secondary" | "long_term" | "event";
  magnitude: number;
  tickOffset: number;
}

export interface CausalEdge {
  from: string;
  to: string;
  relation: string;
  strength: number;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

export interface SimulationEffect {
  domain:
    | "environment"
    | "climate"
    | "creatures"
    | "plants"
    | "resources"
    | "civilizations"
    | "economy"
    | "migrations"
    | "inventions"
    | "wars"
    | "alliances"
    | "population"
    | "disease"
    | "pollution"
    | "politics"
    | "future";
  metric: string;
  delta: number;
  confidence: number;
  explanationKey: string;
}

export interface WorldEventDto {
  id: string;
  type: WorldEventType;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  tick: number;
  year: number;
  importance: number;
  regionId?: string;
  lat?: number;
  lng?: number;
  cause?: string;
  causes: string[];
  effects: SimulationEffect[];
  contributionId?: string;
  userId?: string;
  confidence: number;
  createdAt: string;
}

export interface PlanetSummary {
  id: string;
  name: string;
  nameEn: string;
  seed: number;
  currentTick: number;
  currentYear: number;
  tickUnit: "day" | "month" | "year" | "decade";
  civilizationCount: number;
  cityCount: number;
  speciesCount: number;
  plantCount: number;
  resourceCount: number;
  technologyCount: number;
  activeWars: number;
  activeMigrations: number;
}

export interface RegionDto {
  id: string;
  name: string;
  nameEn: string;
  biome: Biome;
  lat: number;
  lng: number;
  elevation: number;
  temperature: number;
  moisture: number;
  fertility: number;
  pollution: number;
  population: number;
  carryingCapacity: number;
  resources: string[];
  civilizationId?: string;
}

export interface UserImpactStats {
  elementsAdded: number;
  totalChanges: number;
  civilizationsAffected: number;
  evolutionDays: number;
  lastEventTitle?: string;
}

export interface FutureScenario {
  horizonYears: number;
  label: "most_likely" | "best" | "worst";
  probability: number;
  uncertainty: number;
  narrative: string;
  narrativeEn: string;
  keyFactors: string[];
  effects: SimulationEffect[];
}

export interface ContributionPreview {
  structured: StructuredContribution;
  suitableRegions: RegionDto[];
  successProbability: number;
  shortTermEffects: SimulationEffect[];
  longTermEffects: SimulationEffect[];
  causalGraph: CausalGraph;
  scenarios: FutureScenario[];
  narrative: string;
  narrativeEn: string;
  provider: string;
  sandbox: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  level: number;
  xp: number;
  locale: "ar" | "en";
}

export interface TimelineItem {
  id: string;
  year: number;
  title: string;
  titleEn: string;
  kind: string;
  isLive?: boolean;
  imageHint?: string;
  contributionId?: string;
}

export interface WsEnvelope<T = unknown> {
  type: string;
  payload: T;
  ts: number;
}

export interface DeltaUpdate {
  planetId: string;
  tick: number;
  events: WorldEventDto[];
  regionPatches: Array<Partial<RegionDto> & { id: string }>;
  stats?: Partial<PlanetSummary>;
}
