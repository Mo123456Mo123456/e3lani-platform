import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("registered"),
    locale: text("locale").notNull().default("ar"),
    refreshTokenHash: text("refresh_token_hash"),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
    disabled: boolean("disabled").notNull().default(false),
    ...timestamps(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  level: integer("level").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps(),
});

export const roles = pgTable("roles", {
  name: text("name").primaryKey(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const planets = pgTable(
  "planets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    seed: text("seed").notNull(),
    status: text("status").notNull().default("running"),
    currentTick: integer("current_tick").notNull().default(0),
    currentYear: doublePrecision("current_year").notNull().default(0),
    tickUnit: text("tick_unit").notNull().default("year"),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps(),
  },
  (table) => [uniqueIndex("planets_seed_unique").on(table.seed)],
);

export const biomes = pgTable("biomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const planetRegions = pgTable(
  "planet_regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    cellIndex: integer("cell_index").notNull(),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    biome: text("biome").notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    elevation: real("elevation").notNull(),
    temperature: real("temperature").notNull(),
    moisture: real("moisture").notNull(),
    fertility: real("fertility").notNull(),
    population: integer("population").notNull().default(0),
    pollution: real("pollution").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps(),
  },
  (table) => [uniqueIndex("planet_regions_cell_unique").on(table.planetId, table.cellIndex)],
);

export const climateCells = pgTable(
  "climate_cells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull().default(0),
    temperature: real("temperature").notNull(),
    moisture: real("moisture").notNull(),
    pressure: real("pressure"),
    wind: jsonb("wind").$type<Record<string, number>>().notNull().default({}),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("climate_cell_tick_unique").on(table.planetId, table.regionId, table.tick)],
);

const planetEntity = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  traits: jsonb("traits").$type<Record<string, unknown>>().notNull().default({}),
  metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps(),
});

export const species = pgTable("species", {
  ...planetEntity(),
  population: integer("population").notNull().default(0),
  status: text("status").notNull().default("living"),
});

export const plants = pgTable("plants", {
  ...planetEntity(),
  coverage: real("coverage").notNull().default(0),
});

export const resources = pgTable("resources", {
  ...planetEntity(),
  quantity: doublePrecision("quantity").notNull().default(0),
  renewable: boolean("renewable").notNull().default(false),
});

export const civilizations = pgTable("civilizations", {
  ...planetEntity(),
  population: integer("population").notNull().default(0),
  government: text("government"),
  status: text("status").notNull().default("active"),
});

export const cities = pgTable("cities", {
  ...planetEntity(),
  civilizationId: uuid("civilization_id").references(() => civilizations.id, {
    onDelete: "cascade",
  }),
  population: integer("population").notNull().default(0),
});

export const technologies = pgTable("technologies", {
  ...planetEntity(),
  civilizationId: uuid("civilization_id").references(() => civilizations.id, {
    onDelete: "set null",
  }),
  level: integer("level").notNull().default(1),
  effects: jsonb("effects").$type<Record<string, unknown>>().notNull().default({}),
});

export const cultures = pgTable("cultures", {
  ...planetEntity(),
  civilizationId: uuid("civilization_id").references(() => civilizations.id, {
    onDelete: "set null",
  }),
  values: jsonb("values").$type<Record<string, unknown>>().notNull().default({}),
});

export const languages = pgTable("languages", {
  ...planetEntity(),
  civilizationId: uuid("civilization_id").references(() => civilizations.id, {
    onDelete: "set null",
  }),
  vocabulary: jsonb("vocabulary").$type<Record<string, string>>().notNull().default({}),
});

export const tradeRoutes = pgTable("trade_routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  fromCityId: uuid("from_city_id").references(() => cities.id, { onDelete: "cascade" }),
  toCityId: uuid("to_city_id").references(() => cities.id, { onDelete: "cascade" }),
  resources: jsonb("resources").$type<Record<string, number>>().notNull().default({}),
  metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  ...timestamps(),
});

export const alliances = pgTable("alliances", {
  id: uuid("id").primaryKey().defaultRandom(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  memberIds: jsonb("member_ids").$type<string[]>().notNull().default([]),
  terms: jsonb("terms").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("active"),
  ...timestamps(),
});

export const wars = pgTable("wars", {
  id: uuid("id").primaryKey().defaultRandom(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  belligerentIds: jsonb("belligerent_ids").$type<string[]>().notNull().default([]),
  effects: jsonb("effects").$type<Record<string, unknown>>().notNull().default({}),
  startedAtTick: integer("started_at_tick").notNull(),
  endedAtTick: integer("ended_at_tick"),
  ...timestamps(),
});

export const diseases = pgTable("diseases", {
  ...planetEntity(),
  contagion: real("contagion").notNull().default(0),
  lethality: real("lethality").notNull().default(0),
  effects: jsonb("effects").$type<Record<string, unknown>>().notNull().default({}),
});

export const migrations = pgTable("migrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  civilizationId: uuid("civilization_id").references(() => civilizations.id, {
    onDelete: "set null",
  }),
  fromRegionId: uuid("from_region_id").references(() => planetRegions.id, {
    onDelete: "set null",
  }),
  toRegionId: uuid("to_region_id").references(() => planetRegions.id, {
    onDelete: "set null",
  }),
  population: integer("population").notNull().default(0),
  cause: text("cause"),
  metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps(),
});

export const userContributions = pgTable("user_contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  idea: text("idea"),
  structured: jsonb("structured").$type<Record<string, unknown>>().notNull(),
  location: jsonb("location").$type<{ lat: number; lon: number }>().notNull(),
  status: text("status").notNull().default("applied"),
  effects: jsonb("effects").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps(),
});

export const simulationTicks = pgTable(
  "simulation_ticks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull(),
    unit: text("unit").notNull(),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("simulation_tick_unique").on(table.planetId, table.tick)],
);

export const worldEvents = pgTable("world_events", {
  id: uuid("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => planetRegions.id, { onDelete: "set null" }),
  contributionId: uuid("contribution_id").references(() => userContributions.id, {
    onDelete: "set null",
  }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description").notNull(),
  tick: integer("tick").notNull(),
  simYear: doublePrecision("sim_year").notNull(),
  importance: real("importance").notNull(),
  location: jsonb("location").$type<{ lat: number; lon: number } | null>(),
  causeIds: jsonb("cause_ids").$type<string[]>().notNull().default([]),
  effects: jsonb("effects").$type<Record<string, unknown>>().notNull().default({}),
  confidence: real("confidence").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const causalLinks = pgTable(
  "causal_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    fromEventId: uuid("from_event_id")
      .notNull()
      .references(() => worldEvents.id, { onDelete: "cascade" }),
    toEventId: uuid("to_event_id")
      .notNull()
      .references(() => worldEvents.id, { onDelete: "cascade" }),
    relation: text("relation").notNull().default("caused"),
    strength: real("strength").notNull().default(1),
    delayTicks: integer("delay_ticks").notNull().default(0),
    explanation: text("explanation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("causal_link_unique").on(table.planetId, table.fromEventId, table.toEventId),
  ],
);

export const timelineSnapshots = pgTable(
  "timeline_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull(),
    state: jsonb("state").notNull(),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("snapshot_planet_tick_unique").on(table.planetId, table.tick)],
);

export const aiRequests = pgTable("ai_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  operation: text("operation").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  sandbox: boolean("sandbox").notNull().default(false),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moderationResults = pgTable("moderation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  contributionId: uuid("contribution_id").references(() => userContributions.id, {
    onDelete: "cascade",
  }),
  allowed: boolean("allowed").notNull(),
  needsReview: boolean("needs_review").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
  input: text("input"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleName: text("role_name")
      .notNull()
      .references(() => roles.name, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleName] })],
);
