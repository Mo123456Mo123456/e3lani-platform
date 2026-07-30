import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  role: varchar("role", { length: 40 }).notNull().default("user"),
  locale: varchar("locale", { length: 8 }).notNull().default("ar"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planets = pgTable("planets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  seed: varchar("seed", { length: 120 }).notNull().unique(),
  resolution: integer("resolution").notNull().default(64),
  currentTick: integer("current_tick").notNull().default(0),
  currentYear: integer("current_year").notNull().default(-1000),
  status: varchar("status", { length: 32 }).notNull().default("running"),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planetRegions = pgTable(
  "planet_regions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    nameAr: varchar("name_ar", { length: 120 }).notNull(),
    biome: varchar("biome", { length: 40 }).notNull(),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    elevation: real("elevation").notNull(),
    temperature: real("temperature").notNull(),
    moisture: real("moisture").notNull(),
    fertility: real("fertility").notNull(),
    population: integer("population").notNull().default(0),
    pollution: real("pollution").notNull().default(0),
    civilizationId: varchar("civilization_id", { length: 64 }),
    gridX: integer("grid_x").notNull(),
    gridY: integer("grid_y").notNull(),
  },
  (t) => [index("planet_regions_planet_idx").on(t.planetId)],
);

export const civilizations = pgTable("civilizations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  population: integer("population").notNull(),
  techLevel: real("tech_level").notNull(),
  military: real("military").notNull(),
  economy: real("economy").notNull(),
  food: real("food").notNull(),
  stability: real("stability").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().default({}),
});

export const cities = pgTable("cities", {
  id: varchar("id", { length: 64 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  civilizationId: varchar("civilization_id", { length: 64 }).notNull(),
  regionId: varchar("region_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  population: integer("population").notNull(),
});

export const species = pgTable("species", {
  id: varchar("id", { length: 64 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  population: integer("population").notNull(),
  traits: jsonb("traits").$type<Record<string, number>>().default({}),
  contributionId: uuid("contribution_id"),
  data: jsonb("data").$type<Record<string, unknown>>().default({}),
});

export const plants = pgTable("plants", {
  id: varchar("id", { length: 64 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  coverage: real("coverage").notNull(),
  traits: jsonb("traits").$type<Record<string, number>>().default({}),
  contributionId: uuid("contribution_id"),
  data: jsonb("data").$type<Record<string, unknown>>().default({}),
});

export const resources = pgTable("resources", {
  id: varchar("id", { length: 64 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  quantity: real("quantity").notNull(),
  regionId: varchar("region_id", { length: 64 }).notNull(),
  value: real("value").notNull(),
  contributionId: uuid("contribution_id"),
  data: jsonb("data").$type<Record<string, unknown>>().default({}),
});

export const technologies = pgTable("technologies", {
  id: varchar("id", { length: 64 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  level: real("level").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().default({}),
});

export const worldEvents = pgTable(
  "world_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    tick: integer("tick").notNull(),
    year: integer("year").notNull(),
    regionId: varchar("region_id", { length: 64 }),
    title: text("title").notNull(),
    titleAr: text("title_ar").notNull(),
    description: text("description").notNull(),
    descriptionAr: text("description_ar").notNull(),
    importance: real("importance").notNull(),
    cause: text("cause"),
    relatedEntityIds: jsonb("related_entity_ids").$type<string[]>().default([]),
    contributionId: uuid("contribution_id"),
    directImpact: jsonb("direct_impact").$type<Record<string, number>>().default({}),
    confidence: real("confidence").notNull().default(1),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("world_events_planet_tick_idx").on(t.planetId, t.tick),
    index("world_events_type_idx").on(t.type),
  ],
);

export const causalLinks = pgTable("causal_links", {
  id: varchar("id", { length: 96 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  causeEventId: varchar("cause_event_id", { length: 64 }).notNull(),
  effectEventId: varchar("effect_event_id", { length: 64 }).notNull(),
  relation: varchar("relation", { length: 64 }).notNull(),
  strength: real("strength").notNull(),
  delayTicks: integer("delay_ticks").notNull().default(0),
});

export const userContributions = pgTable("user_contributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id),
  category: varchar("category", { length: 40 }).notNull(),
  rawText: text("raw_text").notNull(),
  structured: jsonb("structured").$type<Record<string, unknown>>().notNull(),
  regionId: varchar("region_id", { length: 64 }),
  entityId: varchar("entity_id", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  tickCommitted: integer("tick_committed"),
  yearCommitted: integer("year_committed"),
  impactCount: integer("impact_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiRequests = pgTable("ai_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  provider: varchar("provider", { length: 40 }).notNull(),
  purpose: varchar("purpose", { length: 64 }).notNull(),
  sandbox: boolean("sandbox").notNull().default(true),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  costUsd: real("cost_usd").default(0),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const moderationResults = pgTable("moderation_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  textHash: varchar("text_hash", { length: 64 }).notNull(),
  blocked: boolean("blocked").notNull(),
  reasons: jsonb("reasons").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  body: text("body").notNull(),
  bodyAr: text("body_ar").notNull(),
  kind: varchar("kind", { length: 64 }).notNull(),
  read: boolean("read").notNull().default(false),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const timelineSnapshots = pgTable("timeline_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  tick: integer("tick").notNull(),
  year: integer("year").notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  labelAr: varchar("label_ar", { length: 120 }).notNull(),
  summary: text("summary").notNull(),
  summaryAr: text("summary_ar").notNull(),
  stateBlob: jsonb("state_blob").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  action: varchar("action", { length: 80 }).notNull(),
  targetType: varchar("target_type", { length: 64 }),
  targetId: varchar("target_id", { length: 64 }),
  detail: jsonb("detail").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const simulationTicks = pgTable(
  "simulation_ticks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull(),
    year: integer("year").notNull(),
    eventsCount: integer("events_count").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sim_ticks_planet_tick").on(t.planetId, t.tick)],
);

export const wars = pgTable("wars", {
  id: varchar("id", { length: 96 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  a: varchar("a", { length: 64 }).notNull(),
  b: varchar("b", { length: 64 }).notNull(),
  regionId: varchar("region_id", { length: 64 }),
  intensity: real("intensity").notNull(),
  tickStarted: integer("tick_started").notNull(),
  ended: boolean("ended").notNull().default(false),
});

export const tradeRoutes = pgTable("trade_routes", {
  id: varchar("id", { length: 96 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  fromCityId: varchar("from_city_id", { length: 64 }).notNull(),
  toCityId: varchar("to_city_id", { length: 64 }).notNull(),
  resourceId: varchar("resource_id", { length: 64 }).notNull(),
  distance: real("distance").notNull(),
  risk: real("risk").notNull(),
});

export const analysisCache = pgTable("analysis_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  text: text("text").notNull(),
  structured: jsonb("structured").$type<Record<string, unknown>>().notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  narrative: text("narrative"),
  narrativeAr: text("narrative_ar"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
