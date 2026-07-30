import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const profiles = pgTable("profiles", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  locale: varchar("locale", { length: 16 }).notNull().default("ar"),
  bio: text("bio"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const roles = pgTable("roles", {
  id: id(),
  name: varchar("name", { length: 32 }).notNull().unique(),
  description: text("description"),
  createdAt: createdAt(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const authSessions = pgTable("auth_sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const planets = pgTable("planets", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  seed: integer("seed").notNull(),
  currentTick: integer("current_tick").notNull().default(0),
  isPaused: boolean("is_paused").notNull().default(false),
  stability: doublePrecision("stability").notNull().default(0.7),
  biodiversity: doublePrecision("biodiversity").notNull().default(0.8),
  averageTemperature: doublePrecision("average_temperature").notNull().default(18),
  population: bigint("population", { mode: "number" }).notNull().default(0),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const biomes = pgTable("biomes", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  climateType: varchar("climate_type", { length: 80 }).notNull(),
  carryingCapacity: bigint("carrying_capacity", { mode: "number" }).notNull().default(0),
  properties: jsonb("properties").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
});

export const planetRegions = pgTable("planet_regions", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  biomeId: uuid("biome_id").references(() => biomes.id, { onDelete: "set null" }),
  name: varchar("name", { length: 120 }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  areaKm2: doublePrecision("area_km2").notNull(),
  population: bigint("population", { mode: "number" }).notNull().default(0),
  stability: doublePrecision("stability").notNull().default(0.7),
  geography: jsonb("geography").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const climateCells = pgTable("climate_cells", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "cascade" }),
  gridX: integer("grid_x").notNull(),
  gridY: integer("grid_y").notNull(),
  temperature: doublePrecision("temperature").notNull(),
  precipitation: doublePrecision("precipitation").notNull(),
  atmosphericCarbon: doublePrecision("atmospheric_carbon").notNull(),
  tick: integer("tick").notNull().default(0),
  createdAt: createdAt(),
});

export const species = pgTable("species", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  taxonomy: varchar("taxonomy", { length: 120 }).notNull(),
  population: bigint("population", { mode: "number" }).notNull().default(0),
  conservationStatus: varchar("conservation_status", { length: 40 }).notNull().default("stable"),
  traits: jsonb("traits").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const plants = pgTable("plants", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  biomeId: uuid("biome_id").references(() => biomes.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  abundance: doublePrecision("abundance").notNull().default(0.5),
  edible: boolean("edible").notNull().default(false),
  traits: jsonb("traits").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
});

export const resources = pgTable("resources", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  name: varchar("name", { length: 140 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  quantity: doublePrecision("quantity").notNull(),
  renewability: doublePrecision("renewability").notNull().default(0),
  strategicValue: doublePrecision("strategic_value").notNull().default(0.5),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const civilizations = pgTable("civilizations", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  homeRegionId: uuid("home_region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  government: varchar("government", { length: 100 }).notNull(),
  population: bigint("population", { mode: "number" }).notNull().default(0),
  prosperity: doublePrecision("prosperity").notNull().default(0.5),
  stability: doublePrecision("stability").notNull().default(0.5),
  foundedTick: integer("founded_tick").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cities = pgTable("cities", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  civilizationId: uuid("civilization_id").notNull().references(() => civilizations.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  population: bigint("population", { mode: "number" }).notNull().default(0),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  foundedTick: integer("founded_tick").notNull().default(0),
  infrastructure: jsonb("infrastructure").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const technologies = pgTable("technologies", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  domain: varchar("domain", { length: 80 }).notNull(),
  level: integer("level").notNull().default(1),
  discoveredTick: integer("discovered_tick").notNull(),
  prerequisites: jsonb("prerequisites").notNull().default(sql`'[]'::jsonb`),
  effects: jsonb("effects").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
});

export const civilizationTechnologies = pgTable(
  "civilization_technologies",
  {
    civilizationId: uuid("civilization_id").notNull().references(() => civilizations.id, { onDelete: "cascade" }),
    technologyId: uuid("technology_id").notNull().references(() => technologies.id, { onDelete: "cascade" }),
    adoption: doublePrecision("adoption").notNull().default(0),
    acquiredTick: integer("acquired_tick").notNull(),
  },
  (table) => [primaryKey({ columns: [table.civilizationId, table.technologyId] })],
);

export const cultures = pgTable("cultures", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  civilizationId: uuid("civilization_id").references(() => civilizations.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  values: jsonb("values").notNull().default(sql`'{}'::jsonb`),
  influence: doublePrecision("influence").notNull().default(0.5),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const languages = pgTable("languages", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  cultureId: uuid("culture_id").references(() => cultures.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  speakers: bigint("speakers", { mode: "number" }).notNull().default(0),
  family: varchar("family", { length: 120 }).notNull(),
  writingSystem: varchar("writing_system", { length: 120 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const tradeRoutes = pgTable("trade_routes", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  originCityId: uuid("origin_city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  destinationCityId: uuid("destination_city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  volume: doublePrecision("volume").notNull().default(0),
  goods: jsonb("goods").notNull().default(sql`'[]'::jsonb`),
  establishedTick: integer("established_tick").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const alliances = pgTable("alliances", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  memberCivilizationIds: jsonb("member_civilization_ids").notNull().default(sql`'[]'::jsonb`),
  terms: jsonb("terms").notNull().default(sql`'{}'::jsonb`),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  startedTick: integer("started_tick").notNull(),
  endedTick: integer("ended_tick"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const wars = pgTable("wars", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  belligerentCivilizationIds: jsonb("belligerent_civilization_ids").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  casualties: bigint("casualties", { mode: "number" }).notNull().default(0),
  startedTick: integer("started_tick").notNull(),
  endedTick: integer("ended_tick"),
  causes: jsonb("causes").notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const diseases = pgTable("diseases", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  pathogenType: varchar("pathogen_type", { length: 80 }).notNull(),
  transmissibility: doublePrecision("transmissibility").notNull(),
  mortalityRate: doublePrecision("mortality_rate").notNull(),
  affectedRegionIds: jsonb("affected_region_ids").notNull().default(sql`'[]'::jsonb`),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  emergedTick: integer("emerged_tick").notNull(),
  containedTick: integer("contained_tick"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const migrations = pgTable("migrations", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  originRegionId: uuid("origin_region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  destinationRegionId: uuid("destination_region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  civilizationId: uuid("civilization_id").references(() => civilizations.id, { onDelete: "set null" }),
  population: bigint("population", { mode: "number" }).notNull(),
  cause: varchar("cause", { length: 160 }).notNull(),
  startedTick: integer("started_tick").notNull(),
  endedTick: integer("ended_tick"),
  createdAt: createdAt(),
});

export const userContributions = pgTable(
  "user_contributions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
    proposal: text("proposal").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("accepted"),
    analysis: jsonb("analysis").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    committedTick: integer("committed_tick"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("user_contributions_user_planet_idempotency").on(
      table.userId,
      table.planetId,
      table.idempotencyKey,
    ),
  ],
);

export const simulationTicks = pgTable(
  "simulation_ticks",
  {
    id: id(),
    planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("committed"),
    metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [unique("simulation_ticks_planet_tick").on(table.planetId, table.tick)],
);

export const worldEvents = pgTable("world_events", {
  id: id(),
  planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
  contributionId: uuid("contribution_id").references(() => userContributions.id, { onDelete: "set null" }),
  tick: integer("tick").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  summary: text("summary").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  magnitude: doublePrecision("magnitude").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  isRetracted: boolean("is_retracted").notNull().default(false),
  createdAt: createdAt(),
});

export const causalLinks = pgTable(
  "causal_links",
  {
    id: id(),
    planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
    sourceEventId: uuid("source_event_id").notNull().references(() => worldEvents.id, { onDelete: "cascade" }),
    targetEventId: uuid("target_event_id").notNull().references(() => worldEvents.id, { onDelete: "cascade" }),
    relation: varchar("relation", { length: 80 }).notNull().default("influenced"),
    strength: doublePrecision("strength").notNull().default(0.5),
    createdAt: createdAt(),
  },
  (table) => [unique("causal_links_source_target").on(table.sourceEventId, table.targetEventId)],
);

export const timelineSnapshots = pgTable(
  "timeline_snapshots",
  {
    id: id(),
    planetId: uuid("planet_id").notNull().references(() => planets.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    state: jsonb("state").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique("timeline_snapshots_planet_tick").on(table.planetId, table.tick)],
);

export const aiRequests = pgTable("ai_requests", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  planetId: uuid("planet_id").references(() => planets.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  promptHash: varchar("prompt_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  response: jsonb("response"),
  latencyMs: integer("latency_ms").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

export const moderationResults = pgTable("moderation_results", {
  id: id(),
  aiRequestId: uuid("ai_request_id").references(() => aiRequests.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  allowed: boolean("allowed").notNull(),
  risk: varchar("risk", { length: 32 }).notNull(),
  reasons: jsonb("reasons").notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planetId: uuid("planet_id").references(() => planets.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 80 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  ipAddress: varchar("ip_address", { length: 64 }),
  createdAt: createdAt(),
});
