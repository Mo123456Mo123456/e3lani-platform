import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    role: varchar("role", { length: 64 }).notNull().default("user"),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    locale: varchar("locale", { length: 8 }).notNull().default("ar"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_uidx").on(t.email)],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  elementsAdded: integer("elements_added").notNull().default(0),
  totalImpacts: integer("total_impacts").notNull().default(0),
  impactAgeDays: integer("impact_age_days").notNull().default(0),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId)],
);

export const planets = pgTable("planets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  nameAr: varchar("name_ar", { length: 128 }).notNull(),
  seed: integer("seed").notNull(),
  tick: integer("tick").notNull().default(0),
  year: doublePrecision("year").notNull().default(0),
  tickUnit: varchar("tick_unit", { length: 16 }).notNull().default("year"),
  status: varchar("status", { length: 32 }).notNull().default("running"),
  stateJson: jsonb("state_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planetRegions = pgTable(
  "planet_regions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    nameAr: varchar("name_ar", { length: 128 }).notNull(),
    biome: varchar("biome", { length: 64 }).notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    elevation: doublePrecision("elevation").notNull(),
    temperature: doublePrecision("temperature").notNull(),
    moisture: doublePrecision("moisture").notNull(),
    fertility: doublePrecision("fertility").notNull(),
    pollution: doublePrecision("pollution").notNull(),
    population: integer("population").notNull().default(0),
    data: jsonb("data").notNull().default({}),
  },
  (t) => [index("planet_regions_planet_idx").on(t.planetId)],
);

export const worldEvents = pgTable(
  "world_events",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: text("title").notNull(),
    titleAr: text("title_ar").notNull(),
    description: text("description").notNull(),
    descriptionAr: text("description_ar").notNull(),
    tick: integer("tick").notNull(),
    year: doublePrecision("year").notNull(),
    regionId: varchar("region_id", { length: 64 }),
    importance: doublePrecision("importance").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    causes: jsonb("causes").notNull().$type<string[]>(),
    effects: jsonb("effects").notNull().$type<string[]>(),
    contributionId: uuid("contribution_id"),
    actorIds: jsonb("actor_ids").notNull().$type<string[]>(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("world_events_planet_tick_idx").on(t.planetId, t.tick),
    index("world_events_type_idx").on(t.type),
  ],
);

export const causalLinks = pgTable("causal_links", {
  id: varchar("id", { length: 256 }).primaryKey(),
  planetId: uuid("planet_id")
    .notNull()
    .references(() => planets.id, { onDelete: "cascade" }),
  fromEventId: varchar("from_event_id", { length: 128 }).notNull(),
  toEventId: varchar("to_event_id", { length: 128 }).notNull(),
  relation: varchar("relation", { length: 64 }).notNull(),
  strength: doublePrecision("strength").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
});

export const userContributions = pgTable(
  "user_contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    nameAr: varchar("name_ar", { length: 128 }).notNull(),
    idea: text("idea").notNull(),
    regionId: varchar("region_id", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    structured: jsonb("structured"),
    preview: jsonb("preview"),
    entityId: varchar("entity_id", { length: 128 }),
    appliedTick: integer("applied_tick"),
    narrative: text("narrative"),
    narrativeAr: text("narrative_ar"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("user_contributions_user_idx").on(t.userId)],
);

export const timelineSnapshots = pgTable(
  "timeline_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull(),
    year: doublePrecision("year").notNull(),
    label: varchar("label", { length: 128 }),
    labelAr: varchar("label_ar", { length: 128 }),
    stateHash: varchar("state_hash", { length: 64 }).notNull(),
    stateJson: jsonb("state_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("timeline_snapshots_planet_tick_idx").on(t.planetId, t.tick)],
);

export const aiRequests = pgTable("ai_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 32 }).notNull(),
  purpose: varchar("purpose", { length: 64 }).notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  sandbox: boolean("sandbox").notNull().default(true),
  costUsd: doublePrecision("cost_usd").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const moderationResults = pgTable("moderation_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  allowed: boolean("allowed").notNull(),
  reasons: jsonb("reasons").notNull().$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
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
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  action: varchar("action", { length: 128 }).notNull(),
  targetType: varchar("target_type", { length: 64 }),
  targetId: varchar("target_id", { length: 128 }),
  meta: jsonb("meta").notNull().default({}),
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
    year: doublePrecision("year").notNull(),
    eventCount: integer("event_count").notNull(),
    metrics: jsonb("metrics").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("simulation_ticks_planet_idx").on(t.planetId, t.tick)],
);
