import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("user"),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    locale: text("locale").notNull().default("ar"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  impactScore: real("impact_score").notNull().default(0),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planets = pgTable("planets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  seed: integer("seed").notNull(),
  currentTick: integer("current_tick").notNull().default(0),
  currentYear: integer("current_year").notNull().default(0),
  tickUnit: text("tick_unit").notNull().default("year"),
  status: text("status").notNull().default("running"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planetRegions = pgTable(
  "planet_regions",
  {
    id: text("id").primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameEn: text("name_en").notNull(),
    biome: text("biome").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    elevation: real("elevation").notNull(),
    temperature: real("temperature").notNull(),
    moisture: real("moisture").notNull(),
    fertility: real("fertility").notNull(),
    pollution: real("pollution").notNull().default(0),
    population: integer("population").notNull().default(0),
    carryingCapacity: integer("carrying_capacity").notNull().default(0),
    civilizationId: text("civilization_id"),
  },
  (t) => [index("regions_planet_idx").on(t.planetId)],
);

export const species = pgTable("species", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  population: integer("population").notNull(),
  traits: jsonb("traits").notNull().$type<Record<string, number>>(),
  preferredBiomes: jsonb("preferred_biomes").notNull().$type<string[]>(),
  contributionId: uuid("contribution_id"),
});

export const plants = pgTable("plants", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  coverage: real("coverage").notNull(),
  traits: jsonb("traits").notNull().$type<Record<string, number>>(),
  preferredBiomes: jsonb("preferred_biomes").notNull().$type<string[]>(),
  contributionId: uuid("contribution_id"),
});

export const resources = pgTable("resources", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  regionId: text("region_id").notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  quantity: real("quantity").notNull(),
  value: real("value").notNull(),
  renewal: real("renewal").notNull(),
});

export const civilizations = pgTable("civilizations", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  population: integer("population").notNull(),
  stats: jsonb("stats").notNull().$type<Record<string, number>>(),
  capitalRegionId: text("capital_region_id").notNull(),
  memory: jsonb("memory").notNull().$type<unknown[]>().default([]),
  contributionId: uuid("contribution_id"),
});

export const cities = pgTable("cities", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  civilizationId: text("civilization_id").notNull(),
  regionId: text("region_id").notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  population: integer("population").notNull(),
});

export const technologies = pgTable("technologies", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  level: real("level").notNull(),
  civilizationIds: jsonb("civilization_ids").notNull().$type<string[]>(),
  contributionId: uuid("contribution_id"),
});

export const cultures = pgTable("cultures", {
  id: uuid("id").defaultRandom().primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  civilizationId: text("civilization_id"),
});

export const languages = pgTable("languages", {
  id: uuid("id").defaultRandom().primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  civilizationId: text("civilization_id"),
});

export const tradeRoutes = pgTable("trade_routes", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  fromCityId: text("from_city_id").notNull(),
  toCityId: text("to_city_id").notNull(),
  risk: real("risk").notNull(),
  value: real("value").notNull(),
});

export const alliances = pgTable("alliances", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  aId: text("a_id").notNull(),
  bId: text("b_id").notNull(),
  formedTick: integer("formed_tick").notNull(),
});

export const wars = pgTable("wars", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  aId: text("a_id").notNull(),
  bId: text("b_id").notNull(),
  regionId: text("region_id").notNull(),
  active: boolean("active").notNull().default(true),
  startedTick: integer("started_tick").notNull(),
  strength: real("strength").notNull(),
});

export const diseases = pgTable("diseases", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  infectivity: real("infectivity").notNull(),
  severity: real("severity").notNull(),
  regionIds: jsonb("region_ids").notNull().$type<string[]>(),
});

export const migrations = pgTable("migrations", {
  id: text("id").primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  fromRegionId: text("from_region_id").notNull(),
  toRegionId: text("to_region_id").notNull(),
  population: integer("population").notNull(),
  active: boolean("active").notNull().default(true),
  reason: text("reason").notNull(),
  startedTick: integer("started_tick").notNull(),
});

export const userContributions = pgTable("user_contributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  idea: text("idea").notNull(),
  structured: jsonb("structured").notNull(),
  regionId: text("region_id").notNull(),
  appliedTick: integer("applied_tick").notNull(),
  status: text("status").notNull().default("applied"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const simulationTicks = pgTable("simulation_ticks", {
  id: uuid("id").defaultRandom().primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  tick: integer("tick").notNull(),
  year: integer("year").notNull(),
  eventCount: integer("event_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const worldEvents = pgTable(
  "world_events",
  {
    id: text("id").primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    titleEn: text("title_en").notNull(),
    summary: text("summary").notNull(),
    summaryEn: text("summary_en").notNull(),
    tick: integer("tick").notNull(),
    year: integer("year").notNull(),
    importance: real("importance").notNull(),
    regionId: text("region_id"),
    lat: real("lat"),
    lng: real("lng"),
    causes: jsonb("causes").notNull().$type<string[]>(),
    effects: jsonb("effects").notNull().$type<unknown[]>(),
    contributionId: uuid("contribution_id"),
    userId: uuid("user_id"),
    confidence: real("confidence").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("events_planet_tick_idx").on(t.planetId, t.tick)],
);

export const causalLinks = pgTable("causal_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  contributionId: uuid("contribution_id"),
  graph: jsonb("graph").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const timelineSnapshots = pgTable("timeline_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  tick: integer("tick").notNull(),
  year: integer("year").notNull(),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiRequests = pgTable("ai_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  provider: text("provider").notNull(),
  sandbox: boolean("sandbox").notNull(),
  purpose: text("purpose").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const moderationResults = pgTable("moderation_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  content: text("content").notNull(),
  allowed: boolean("allowed").notNull(),
  reasons: jsonb("reasons").notNull().$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const worldStateBlobs = pgTable("world_state_blobs", {
  planetId: uuid("planet_id")
    .primaryKey()
    .references(() => planets.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
