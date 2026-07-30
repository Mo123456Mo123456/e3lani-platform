export type Locale = "ar" | "en";
export type TextDirection = "rtl" | "ltr";

export type ElementCategory =
  | "creature"
  | "plant"
  | "resource"
  | "civilization"
  | "city"
  | "invention"
  | "technology"
  | "disease"
  | "climate_phenomenon"
  | "natural_law"
  | "disaster"
  | "alliance"
  | "culture"
  | "language"
  | "transport"
  | "energy"
  | "custom";

export type GraphicsQuality = "ultra" | "high" | "medium" | "power_saver";

export type PlanetLayer =
  | "surface"
  | "biome"
  | "weather"
  | "civilization"
  | "resource"
  | "conflict"
  | "migration"
  | "trade"
  | "pollution"
  | "temperature"
  | "historical";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  level: number;
  xp: number;
  locale?: Locale;
  avatarUrl?: string;
}

export interface RegionSummary {
  id: string;
  name: string;
  nameAr: string;
  biome: string;
  lat: number;
  lon: number;
  elevation?: number;
  temperature: number;
  moisture: number;
  fertility: number;
  population: number;
  pollution: number;
  resourceCount: number;
  civilizationId?: string;
}

export interface CivilizationSummary {
  id: string;
  name: string;
  nameAr: string;
  population: number;
  techLevel: number;
  military: number;
  economy: number;
  stability: number;
  happiness: number;
  pollution: number;
  color: string;
  capitalCityId?: string;
}

export interface PlanetOverlayMarker {
  id: string;
  category: ElementCategory | "weather" | "disaster" | "war" | "migration" | "invention";
  label: string;
  labelAr: string;
  value: string;
  valueAr: string;
  lat: number;
  lon: number;
  color: string;
}

export interface PlanetDto {
  id: string;
  name?: string;
  nameAr?: string;
  year?: number;
  tick?: number;
  pollution?: number;
  temperature?: number;
  biodiversity?: number;
  regions?: RegionSummary[];
  civilizations?: CivilizationSummary[];
  overlays?: PlanetOverlayMarker[];
  markers?: PlanetOverlayMarker[];
}

export interface WorldEventDto {
  id: string;
  type: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  tick?: number;
  year?: number;
  importance: number;
  regionId?: string;
  lat?: number;
  lon?: number;
  confidence?: number;
  directImpact?: Record<string, number>;
  thumbnailUrl?: string;
  createdAt: string;
}

export interface TimelineMilestone {
  id: string;
  title: string;
  titleAr?: string;
  tick: number;
  year?: number;
  category?: string;
  importance?: number;
  description?: string;
  descriptionAr?: string;
}

export interface UserImpactStats {
  elementsAdded: number;
  totalImpacts: number;
  evolutionDays: number;
  civilizationsAffected: number;
  lastEventTitle?: string;
  lastEventTitleAr?: string;
}

export interface ElementTraits {
  [key: string]: number | undefined;
}

export interface StructuredElement {
  category: ElementCategory;
  name: string;
  nameAr?: string;
  nameEn?: string;
  description: string;
  traits: ElementTraits;
  possibleBiomes?: string[];
  risks?: string[];
  benefits?: string[];
  balanceScore?: number;
  wasBalanced?: boolean;
  balanceNotes?: string[];
}

export interface CausalNode {
  id: string;
  label: string;
  kind: "cause" | "direct" | "secondary" | "long_term" | "event" | string;
  magnitude: number;
  confidence: number;
  tickOffset: number;
}

export interface CausalEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

export interface ScenarioForecast {
  horizonYears: number;
  mostLikely: string;
  mostLikelyAr?: string;
  bestCase: string;
  bestCaseAr?: string;
  worstCase: string;
  worstCaseAr?: string;
  uncertainty: number;
  keyFactors?: string[];
  keyFactorsAr?: string[];
}

export interface ContributionAnalysis {
  id?: string;
  structuredElement?: StructuredElement;
  element?: StructuredElement;
  risks?: string[];
  benefits?: string[];
  causalGraph?: CausalGraph;
  forecast?: ScenarioForecast;
}

export interface ContributionResult {
  id: string;
  status: string;
  message?: string;
  messageAr?: string;
  causalGraph?: CausalGraph;
  forecast?: ScenarioForecast;
  contribution?: {
    id: string;
    status: string;
  };
}

export interface AuthResponse {
  token?: string;
  accessToken?: string;
  user: AuthUser;
}

export interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  code?: string;
  details?: unknown;
}
