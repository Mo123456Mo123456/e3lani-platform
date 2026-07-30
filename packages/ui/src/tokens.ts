/**
 * Design tokens — futuristic dark command-deck.
 * Mirrored as CSS variables in each app's globals.css.
 */
export const colors = {
  bg: "#050b14", // black-blue main background
  bgPanel: "#0a1420",
  bgPanelAlt: "#0d1a2a",
  border: "#1b2b40",
  tech: "#38bdf8", // sky blue — technical elements
  techDim: "#0e7490",
  nature: "#34d399", // plants & environment
  civ: "#f5c452", // civilizations — gold
  migration: "#a78bfa", // migrations & cultures — violet
  war: "#f87171", // wars & disasters — red
  hazard: "#fb923c", // volcanoes & risks — orange
  text: "#e6edf3",
  textDim: "#8b98a9",
  success: "#4ade80",
  warning: "#facc15",
} as const;

export const radii = { panel: "10px", control: "8px" } as const;

export const categoryColor: Record<string, string> = {
  creature: colors.nature,
  plant: colors.nature,
  resource: colors.civ,
  civilization: colors.civ,
  invention: colors.tech,
  natural_phenomenon: colors.tech,
  disease: colors.war,
  culture: colors.migration,
  world_law: colors.migration,
  custom: colors.textDim,
};

export const eventColor: Record<string, string> = {
  WAR_STARTED: colors.war,
  WAR_ENDED: colors.war,
  CITY_DESTROYED: colors.war,
  DISEASE_OUTBREAK: colors.war,
  SPECIES_EXTINCT: colors.war,
  VOLCANO_ERUPTED: colors.hazard,
  WILDFIRE_STARTED: colors.hazard,
  DROUGHT_STARTED: colors.hazard,
  CIVILIZATION_FOUNDED: colors.civ,
  CITY_CREATED: colors.civ,
  TECHNOLOGY_DISCOVERED: colors.tech,
  RESOURCE_DISCOVERED: colors.civ,
  TRADE_ROUTE_CREATED: colors.civ,
  ALLIANCE_CREATED: colors.migration,
  MIGRATION_STARTED: colors.migration,
  SPECIES_CREATED: colors.nature,
  SPECIES_MUTATED: colors.nature,
  PLANTS_SPREAD: colors.nature,
  CLIMATE_CHANGED: colors.tech,
  ELEMENT_ADDED: colors.tech,
};

export function categoryColorOf(category: string): string {
  return categoryColor[category] ?? colors.textDim;
}

export function eventColorOf(type: string): string {
  return eventColor[type] ?? colors.tech;
}
