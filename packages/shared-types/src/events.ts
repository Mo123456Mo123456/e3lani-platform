/**
 * World event contract — mirrors services/simulation-engine/app/events.py.
 * Keep in sync; the API persists these verbatim.
 */
export const EVENT_TYPES = [
  "WORLD_GENESIS",
  "RESOURCE_DISCOVERED",
  "RESOURCE_DEPLETED",
  "SPECIES_CREATED",
  "SPECIES_MUTATED",
  "SPECIES_EXTINCT",
  "SPECIES_MIGRATED",
  "PLANT_SPREAD",
  "CIVILIZATION_FOUNDED",
  "CIVILIZATION_COLLAPSED",
  "CITY_CREATED",
  "CITY_CAPTURED",
  "TECHNOLOGY_DISCOVERED",
  "WAR_STARTED",
  "WAR_ENDED",
  "TERRITORY_CHANGED",
  "MIGRATION_STARTED",
  "ALLIANCE_CREATED",
  "ALLIANCE_BROKEN",
  "DISEASE_OUTBREAK",
  "DISEASE_CONTAINED",
  "CLIMATE_CHANGED",
  "STORM_FORMED",
  "DROUGHT_STARTED",
  "WILDFIRE_STARTED",
  "FLOOD_OCCURRED",
  "VOLCANO_ERUPTED",
  "TRADE_ROUTE_CREATED",
  "GOVERNMENT_CHANGED",
  "CULTURE_EVOLVED",
  "CONTRIBUTION_APPLIED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface WorldEvent {
  id: string;
  tick: number;
  type: EventType;
  importance: 1 | 2 | 3 | 4 | 5;
  cellId: number | null;
  civIds: string[];
  speciesIds: string[];
  plantIds: string[];
  /** null for roots (genesis or user contribution) */
  causeEventId: string | null;
  /** set when the event descends from a user contribution */
  contributionId: string | null;
  confidence: number;
  payload: Record<string, unknown>;
}

export interface CausalNodeView {
  event: WorldEvent;
  depth: number;
}

export interface CausalChain {
  root: WorldEvent | null;
  ancestors: WorldEvent[];
  descendants: WorldEvent[];
}

export const EVENT_SEVERITY_ORDER: Record<EventType, number> = {
  WORLD_GENESIS: 5,
  WAR_STARTED: 5,
  CIVILIZATION_COLLAPSED: 5,
  CIVILIZATION_FOUNDED: 4,
  VOLCANO_ERUPTED: 4,
  DISEASE_OUTBREAK: 4,
  WAR_ENDED: 4,
  CITY_CAPTURED: 4,
  TECHNOLOGY_DISCOVERED: 3,
  CLIMATE_CHANGED: 3,
  CITY_CREATED: 3,
  ALLIANCE_CREATED: 3,
  ALLIANCE_BROKEN: 3,
  SPECIES_EXTINCT: 3,
  CONTRIBUTION_APPLIED: 4,
  GOVERNMENT_CHANGED: 3,
  DISEASE_CONTAINED: 3,
  FLOOD_OCCURRED: 3,
  DROUGHT_STARTED: 3,
  MIGRATION_STARTED: 2,
  TRADE_ROUTE_CREATED: 2,
  SPECIES_MUTATED: 2,
  RESOURCE_DEPLETED: 2,
  STORM_FORMED: 2,
  WILDFIRE_STARTED: 2,
  SPECIES_CREATED: 2,
  SPECIES_MIGRATED: 1,
  PLANT_SPREAD: 1,
  TERRITORY_CHANGED: 1,
  CULTURE_EVOLVED: 1,
  RESOURCE_DISCOVERED: 1,
};

/** Display grouping for feeds and filters. */
export const EVENT_CATEGORY: Record<EventType, string> = {
  WORLD_GENESIS: "world",
  RESOURCE_DISCOVERED: "resources",
  RESOURCE_DEPLETED: "resources",
  SPECIES_CREATED: "life",
  SPECIES_MUTATED: "life",
  SPECIES_EXTINCT: "life",
  SPECIES_MIGRATED: "life",
  PLANT_SPREAD: "life",
  CIVILIZATION_FOUNDED: "civilizations",
  CIVILIZATION_COLLAPSED: "civilizations",
  CITY_CREATED: "civilizations",
  CITY_CAPTURED: "conflicts",
  TECHNOLOGY_DISCOVERED: "technology",
  WAR_STARTED: "conflicts",
  WAR_ENDED: "conflicts",
  TERRITORY_CHANGED: "civilizations",
  MIGRATION_STARTED: "migrations",
  ALLIANCE_CREATED: "alliances",
  ALLIANCE_BROKEN: "alliances",
  DISEASE_OUTBREAK: "diseases",
  DISEASE_CONTAINED: "diseases",
  CLIMATE_CHANGED: "climate",
  STORM_FORMED: "climate",
  DROUGHT_STARTED: "climate",
  WILDFIRE_STARTED: "climate",
  FLOOD_OCCURRED: "climate",
  VOLCANO_ERUPTED: "climate",
  TRADE_ROUTE_CREATED: "economy",
  GOVERNMENT_CHANGED: "civilizations",
  CULTURE_EVOLVED: "culture",
  CONTRIBUTION_APPLIED: "contributions",
};
