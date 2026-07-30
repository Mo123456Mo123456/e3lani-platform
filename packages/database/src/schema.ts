import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const userStatus = pgEnum("user_status", [
  "active",
  "suspended",
  "deleted",
]);
export const contributionStatus = pgEnum("contribution_status", [
  "draft",
  "analyzed",
  "queued",
  "simulating",
  "committed",
  "rejected",
  "failed",
]);
export const tickStatus = pgEnum("tick_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash"),
    status: userStatus("status").notNull().default("active"),
    locale: varchar("locale", { length: 5 }).notNull().default("ar"),
    refreshTokenVersion: integer("refresh_token_version").notNull().default(0),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  avatarUrl: text("avatar_url"),
  impactScore: integer("impact_score").notNull().default(0),
  bio: varchar("bio", { length: 500 }),
  createdAt,
  updatedAt,
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  createdAt,
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: createdAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const planets = pgTable("planets", {
  id: uuid("id").primaryKey(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  nameEn: varchar("name_en", { length: 120 }).notNull(),
  seed: varchar("seed", { length: 200 }).notNull().unique(),
  algorithmVersion: varchar("algorithm_version", { length: 32 })
    .notNull()
    .default("worldgen-1"),
  currentTick: bigint("current_tick", { mode: "number" }).notNull().default(0),
  currentYear: integer("current_year").notNull(),
  tickDuration: varchar("tick_duration", { length: 16 })
    .notNull()
    .default("year"),
  running: boolean("running").notNull().default(false),
  stateHash: varchar("state_hash", { length: 64 }).notNull(),
  createdAt,
  updatedAt,
});

export const biomes = pgTable("biomes", {
  id: varchar("id", { length: 40 }).primaryKey(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  constraints: jsonb("constraints").notNull().default({}),
});

export const planetRegions = pgTable(
  "planet_regions",
  {
    id: uuid("id").primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    biomeId: varchar("biome_id", { length: 40 })
      .notNull()
      .references(() => biomes.id),
    regionIndex: integer("region_index").notNull(),
    nameAr: varchar("name_ar", { length: 120 }).notNull(),
    nameEn: varchar("name_en", { length: 120 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    elevation: real("elevation").notNull(),
    temperature: real("temperature").notNull(),
    moisture: real("moisture").notNull(),
    fertility: real("fertility").notNull(),
    pollution: real("pollution").notNull().default(0),
    population: bigint("population", { mode: "number" }).notNull().default(0),
    resourceRichness: real("resource_richness").notNull(),
    cell: jsonb("cell").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("planet_regions_planet_index_unique").on(
      table.planetId,
      table.regionIndex,
    ),
    index("planet_regions_planet_biome_idx").on(table.planetId, table.biomeId),
  ],
);

export const climateCells = pgTable(
  "climate_cells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    regionId: uuid("region_id")
      .notNull()
      .references(() => planetRegions.id, { onDelete: "cascade" }),
    temperature: real("temperature").notNull(),
    humidity: real("humidity").notNull(),
    pressure: real("pressure").notNull(),
    windU: real("wind_u").notNull(),
    windV: real("wind_v").notNull(),
    precipitation: real("precipitation").notNull(),
    tick: bigint("tick", { mode: "number" }).notNull(),
    updatedAt,
  },
  (table) => [uniqueIndex("climate_cells_region_unique").on(table.regionId)],
);

const worldEntityColumns = {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  regionId: uuid("region_id")
    .notNull()
    .references(() => planetRegions.id),
  name: varchar("name", { length: 160 }).notNull(),
  population: bigint("population", { mode: "number" }).notNull().default(0),
  health: real("health").notNull().default(1),
  traits: jsonb("traits").notNull().default({}),
  createdAt,
  updatedAt,
};

export const species = pgTable("species", {
  ...worldEntityColumns,
  diet: varchar("diet", { length: 40 }),
  mutationRate: real("mutation_rate").notNull().default(0.01),
  extinctionRisk: real("extinction_risk").notNull().default(0),
});

export const plants = pgTable("plants", {
  ...worldEntityColumns,
  growthRate: real("growth_rate").notNull().default(0.5),
  waterNeed: real("water_need").notNull().default(0.5),
});

export const resources = pgTable("resources", {
  ...worldEntityColumns,
  quantity: doublePrecision("quantity").notNull().default(0),
  regenerationRate: real("regeneration_rate").notNull().default(0),
  extractionRate: real("extraction_rate").notNull().default(0),
  unitValue: doublePrecision("unit_value").notNull().default(0),
});

export const civilizations = pgTable("civilizations", {
  ...worldEntityColumns,
  government: varchar("government", { length: 80 }),
  technologyLevel: real("technology_level").notNull().default(0),
  militaryPower: real("military_power").notNull().default(0),
  economicPower: real("economic_power").notNull().default(0),
  stability: real("stability").notNull().default(0.5),
  historicalMemory: jsonb("historical_memory").notNull().default([]),
});

export const cities = pgTable("cities", {
  ...worldEntityColumns,
  civilizationId: uuid("civilization_id").references(() => civilizations.id),
  foodStock: doublePrecision("food_stock").notNull().default(0),
  infrastructure: real("infrastructure").notNull().default(0),
});

export const technologies = pgTable("technologies", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  civilizationId: uuid("civilization_id").references(() => civilizations.id),
  name: varchar("name", { length: 160 }).notNull(),
  level: integer("level").notNull().default(1),
  prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
  effects: jsonb("effects").notNull().default({}),
  discoveredAtTick: bigint("discovered_at_tick", { mode: "number" }).notNull(),
  createdAt,
});

export const languages = pgTable("languages", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  parentLanguageId: uuid("parent_language_id"),
  speakerCount: bigint("speaker_count", { mode: "number" }).notNull().default(0),
  features: jsonb("features").notNull().default({}),
  createdAt,
});

export const cultures = pgTable("cultures", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  civilizationId: uuid("civilization_id").references(() => civilizations.id),
  languageId: uuid("language_id").references(() => languages.id),
  name: varchar("name", { length: 120 }).notNull(),
  values: jsonb("values").notNull().default({}),
  influence: real("influence").notNull().default(0),
  createdAt,
  updatedAt,
});

export const tradeRoutes = pgTable("trade_routes", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  originCityId: uuid("origin_city_id")
    .notNull()
    .references(() => cities.id),
  destinationCityId: uuid("destination_city_id")
    .notNull()
    .references(() => cities.id),
  path: jsonb("path").$type<string[]>().notNull(),
  distance: real("distance").notNull(),
  risk: real("risk").notNull(),
  volume: doublePrecision("volume").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt,
});

export const alliances = pgTable("alliances", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  memberCivilizationIds: jsonb("member_civilization_ids")
    .$type<string[]>()
    .notNull(),
  terms: jsonb("terms").notNull().default({}),
  foundedAtTick: bigint("founded_at_tick", { mode: "number" }).notNull(),
  dissolvedAtTick: bigint("dissolved_at_tick", { mode: "number" }),
});

export const wars = pgTable("wars", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  attackerIds: jsonb("attacker_ids").$type<string[]>().notNull(),
  defenderIds: jsonb("defender_ids").$type<string[]>().notNull(),
  causes: jsonb("causes").notNull(),
  startedAtTick: bigint("started_at_tick", { mode: "number" }).notNull(),
  endedAtTick: bigint("ended_at_tick", { mode: "number" }),
  outcome: jsonb("outcome"),
  casualties: bigint("casualties", { mode: "number" }).notNull().default(0),
});

export const diseases = pgTable("diseases", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  originRegionId: uuid("origin_region_id").references(() => planetRegions.id),
  transmissibility: real("transmissibility").notNull(),
  mortality: real("mortality").notNull(),
  affectedEntityIds: jsonb("affected_entity_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  createdAt,
});

export const migrations = pgTable("migrations", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  originRegionId: uuid("origin_region_id")
    .notNull()
    .references(() => planetRegions.id),
  destinationRegionId: uuid("destination_region_id")
    .notNull()
    .references(() => planetRegions.id),
  entityId: uuid("entity_id").notNull(),
  population: bigint("population", { mode: "number" }).notNull(),
  path: jsonb("path").$type<string[]>().notNull(),
  cause: text("cause").notNull(),
  startedAtTick: bigint("started_at_tick", { mode: "number" }).notNull(),
  endedAtTick: bigint("ended_at_tick", { mode: "number" }),
});

export const userContributions = pgTable(
  "user_contributions",
  {
    id: uuid("id").primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    regionId: uuid("region_id")
      .notNull()
      .references(() => planetRegions.id),
    category: varchar("category", { length: 40 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    originalIdea: text("original_idea").notNull(),
    structuredAnalysis: jsonb("structured_analysis").notNull(),
    status: contributionStatus("status").notNull().default("draft"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("user_contributions_idempotency_unique").on(
      table.userId,
      table.idempotencyKey,
    ),
  ],
);

export const simulationTicks = pgTable(
  "simulation_ticks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    tick: bigint("tick", { mode: "number" }).notNull(),
    year: integer("year").notNull(),
    status: tickStatus("status").notNull().default("queued"),
    seedState: varchar("seed_state", { length: 128 }).notNull(),
    stateHash: varchar("state_hash", { length: 64 }),
    durationMs: integer("duration_ms"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    uniqueIndex("simulation_ticks_planet_tick_unique").on(
      table.planetId,
      table.tick,
    ),
  ],
);

export const worldEvents = pgTable(
  "world_events",
  {
    id: uuid("id").primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    tick: bigint("tick", { mode: "number" }).notNull(),
    year: integer("year").notNull(),
    regionId: uuid("region_id").references(() => planetRegions.id),
    contributionId: uuid("contribution_id").references(
      () => userContributions.id,
    ),
    cause: text("cause").notNull(),
    causeEventIds: jsonb("cause_event_ids").$type<string[]>().notNull(),
    actorIds: jsonb("actor_ids").$type<string[]>().notNull(),
    payload: jsonb("payload").notNull(),
    confidence: real("confidence").notNull(),
    directImpact: jsonb("direct_impact").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("world_events_planet_sequence_unique").on(
      table.planetId,
      table.sequence,
    ),
    index("world_events_planet_tick_idx").on(table.planetId, table.tick),
    index("world_events_contribution_idx").on(table.contributionId),
  ],
);

export const causalLinks = pgTable(
  "causal_links",
  {
    sourceEventId: uuid("source_event_id")
      .notNull()
      .references(() => worldEvents.id, { onDelete: "cascade" }),
    targetEventId: uuid("target_event_id")
      .notNull()
      .references(() => worldEvents.id, { onDelete: "cascade" }),
    relation: varchar("relation", { length: 24 }).notNull(),
    strength: real("strength").notNull(),
    explanation: text("explanation").notNull(),
    createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.sourceEventId, table.targetEventId] }),
  ],
);

export const timelineSnapshots = pgTable(
  "timeline_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    tick: bigint("tick", { mode: "number" }).notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    stateHash: varchar("state_hash", { length: 64 }).notNull(),
    storageKey: text("storage_key").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("timeline_snapshots_planet_tick_unique").on(
      table.planetId,
      table.tick,
    ),
  ],
);

export const aiRequests = pgTable("ai_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  contributionId: uuid("contribution_id").references(
    () => userContributions.id,
  ),
  provider: varchar("provider", { length: 40 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  purpose: varchar("purpose", { length: 64 }).notNull(),
  promptHash: varchar("prompt_hash", { length: 64 }).notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costMicros: integer("cost_micros").notNull().default(0),
  durationMs: integer("duration_ms"),
  success: boolean("success").notNull(),
  errorCode: varchar("error_code", { length: 80 }),
  createdAt,
});

export const moderationResults = pgTable("moderation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  contributionId: uuid("contribution_id")
    .notNull()
    .references(() => userContributions.id, { onDelete: "cascade" }),
  accepted: boolean("accepted").notNull(),
  ruleMatches: jsonb("rule_matches").$type<string[]>().notNull(),
  classifierScores: jsonb("classifier_scores").notNull().default({}),
  promptInjectionScore: real("prompt_injection_score").notNull().default(0),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdAt,
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    data: jsonb("data").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [index("notifications_user_created_idx").on(table.userId, table.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: varchar("resource_id", { length: 160 }),
    before: jsonb("before"),
    after: jsonb("after"),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 500 }),
    traceId: varchar("trace_id", { length: 64 }),
    createdAt,
  },
  (table) => [index("audit_logs_resource_idx").on(table.resourceType, table.resourceId)],
);

export const worldMemory = pgTable(
  "world_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id"),
    memoryType: varchar("memory_type", { length: 64 }).notNull(),
    content: text("content").notNull(),
    facts: jsonb("facts").notNull().default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
    validFromTick: bigint("valid_from_tick", { mode: "number" }).notNull(),
    validToTick: bigint("valid_to_tick", { mode: "number" }),
    createdAt,
  },
  (table) => [index("world_memory_planet_entity_idx").on(table.planetId, table.entityId)],
);
