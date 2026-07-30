import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
};

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status').notNull().default('active'), // active | suspended | banned
  ...timestamps,
});

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').default('ar'),
  preferences: text('preferences', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  ...timestamps,
});

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  level: integer('level').notNull().default(0),
});

export const userRoles = sqliteTable(
  'user_roles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    roleId: text('role_id').notNull().references(() => roles.id),
    grantedAt: text('granted_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('user_roles_user_role_uq').on(t.userId, t.roleId)],
);

export const planets = sqliteTable('planets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  seed: text('seed').notNull().unique(),
  status: text('status').notNull().default('active'),
  ageYears: integer('age_years').notNull().default(0),
  currentTick: integer('current_tick').notNull().default(0),
  resolution: integer('resolution').notNull().default(64),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  ...timestamps,
});

export const planetRegions = sqliteTable(
  'planet_regions',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    name: text('name').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    elevation: real('elevation').notNull().default(0),
    moisture: real('moisture').notNull().default(0.5),
    temperature: real('temperature').notNull().default(15),
    biomeId: text('biome_id'),
    ...timestamps,
  },
  (t) => [index('planet_regions_planet_idx').on(t.planetId)],
);

export const biomes = sqliteTable('biomes', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  name: text('name').notNull(),
  code: text('code').notNull(),
  color: text('color'),
  habitability: real('habitability').notNull().default(0.5),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
});

export const climateCells = sqliteTable(
  'climate_cells',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    regionId: text('region_id').references(() => planetRegions.id),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    temperature: real('temperature').notNull(),
    humidity: real('humidity').notNull(),
    windSpeed: real('wind_speed').notNull().default(0),
    pressure: real('pressure').notNull().default(1013),
    tick: integer('tick').notNull().default(0),
  },
  (t) => [index('climate_cells_planet_tick_idx').on(t.planetId, t.tick)],
);

export const species = sqliteTable(
  'species',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    name: text('name').notNull(),
    scientificName: text('scientific_name'),
    kingdom: text('kingdom').notNull().default('animalia'),
    trophicLevel: integer('trophic_level').notNull().default(2),
    population: integer('population').notNull().default(1000),
    status: text('status').notNull().default('thriving'), // thriving | declining | endangered | extinct
    dependsOnPlantId: text('depends_on_plant_id'),
    regionId: text('region_id'),
    traits: text('traits', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (t) => [index('species_planet_idx').on(t.planetId)],
);

export const plants = sqliteTable(
  'plants',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    name: text('name').notNull(),
    scientificName: text('scientific_name'),
    growthRate: real('growth_rate').notNull().default(1),
    coverage: real('coverage').notNull().default(0.1),
    biomeId: text('biome_id'),
    regionId: text('region_id'),
    status: text('status').notNull().default('abundant'),
    traits: text('traits', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (t) => [index('plants_planet_idx').on(t.planetId)],
);

export const resources = sqliteTable(
  'resources',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    name: text('name').notNull(),
    type: text('type').notNull(), // mineral | organic | energy | water | rare
    abundance: real('abundance').notNull().default(0.5),
    renewability: real('renewability').notNull().default(0),
    regionId: text('region_id'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  },
  (t) => [index('resources_planet_idx').on(t.planetId)],
);

export const civilizations = sqliteTable(
  'civilizations',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    name: text('name').notNull(),
    era: text('era').notNull().default('stone'),
    population: integer('population').notNull().default(10000),
    techLevel: real('tech_level').notNull().default(0.1),
    cultureId: text('culture_id'),
    languageId: text('language_id'),
    capitalCityId: text('capital_city_id'),
    status: text('status').notNull().default('rising'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (t) => [index('civilizations_planet_idx').on(t.planetId)],
);

export const cities = sqliteTable(
  'cities',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    civilizationId: text('civilization_id').notNull().references(() => civilizations.id),
    name: text('name').notNull(),
    regionId: text('region_id'),
    population: integer('population').notNull().default(1000),
    prosperity: real('prosperity').notNull().default(0.5),
    x: integer('x').notNull().default(0),
    y: integer('y').notNull().default(0),
    isCapital: integer('is_capital', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index('cities_civ_idx').on(t.civilizationId)],
);

export const technologies = sqliteTable('technologies', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  civilizationId: text('civilization_id').references(() => civilizations.id),
  name: text('name').notNull(),
  category: text('category').notNull().default('general'),
  level: integer('level').notNull().default(1),
  discoveredAtTick: integer('discovered_at_tick').notNull().default(0),
  effects: text('effects', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
});

export const cultures = sqliteTable('cultures', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  civilizationId: text('civilization_id').references(() => civilizations.id),
  name: text('name').notNull(),
  culturalValues: text('values', { mode: 'json' }).$type<string[]>().default([]),
  arts: text('arts', { mode: 'json' }).$type<string[]>().default([]),
  religion: text('religion'),
});

export const languages = sqliteTable('languages', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  name: text('name').notNull(),
  family: text('family'),
  script: text('script'),
  speakers: integer('speakers').notNull().default(0),
});

export const tradeRoutes = sqliteTable('trade_routes', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  fromCityId: text('from_city_id').notNull().references(() => cities.id),
  toCityId: text('to_city_id').notNull().references(() => cities.id),
  resourceId: text('resource_id').references(() => resources.id),
  volume: real('volume').notNull().default(1),
  status: text('status').notNull().default('active'),
});

export const alliances = sqliteTable('alliances', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  name: text('name').notNull(),
  civAId: text('civ_a_id').notNull().references(() => civilizations.id),
  civBId: text('civ_b_id').notNull().references(() => civilizations.id),
  strength: real('strength').notNull().default(0.5),
  formedAtTick: integer('formed_at_tick').notNull().default(0),
  status: text('status').notNull().default('active'),
});

export const wars = sqliteTable('wars', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  name: text('name').notNull(),
  aggressorId: text('aggressor_id').notNull().references(() => civilizations.id),
  defenderId: text('defender_id').notNull().references(() => civilizations.id),
  cause: text('cause'),
  startedAtTick: integer('started_at_tick').notNull().default(0),
  endedAtTick: integer('ended_at_tick'),
  status: text('status').notNull().default('ongoing'),
  casualties: integer('casualties').notNull().default(0),
});

export const diseases = sqliteTable('diseases', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  name: text('name').notNull(),
  virulence: real('virulence').notNull().default(0.3),
  spreadRate: real('spread_rate').notNull().default(0.1),
  mortality: real('mortality').notNull().default(0.05),
  affectedSpeciesId: text('affected_species_id'),
  affectedCivId: text('affected_civ_id'),
  status: text('status').notNull().default('active'),
  discoveredAtTick: integer('discovered_at_tick').notNull().default(0),
});

export const migrations = sqliteTable('migrations', {
  id: text('id').primaryKey(),
  planetId: text('planet_id').notNull().references(() => planets.id),
  entityType: text('entity_type').notNull(), // species | civilization | plant
  entityId: text('entity_id').notNull(),
  fromRegionId: text('from_region_id'),
  toRegionId: text('to_region_id'),
  tick: integer('tick').notNull().default(0),
  reason: text('reason'),
  populationMoved: integer('population_moved').notNull().default(0),
});

export const userContributions = sqliteTable(
  'user_contributions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    planetId: text('planet_id').notNull().references(() => planets.id),
    type: text('type').notNull(), // species | plant | element | invention | event | culture
    title: text('title').notNull(),
    description: text('description'),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('pending'), // pending | analyzing | balanced | preview | injected | rejected
    analysis: text('analysis', { mode: 'json' }).$type<Record<string, unknown>>(),
    balanceScore: real('balance_score'),
    injectedAtTick: integer('injected_at_tick'),
    injectedEntityId: text('injected_entity_id'),
    ...timestamps,
  },
  (t) => [index('contributions_user_idx').on(t.userId), index('contributions_planet_idx').on(t.planetId)],
);

export const simulationTicks = sqliteTable(
  'simulation_ticks',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    tick: integer('tick').notNull(),
    year: integer('year').notNull(),
    deltaSummary: text('delta_summary', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    processedAt: text('processed_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('sim_ticks_planet_tick_uq').on(t.planetId, t.tick)],
);

export const worldEvents = sqliteTable(
  'world_events',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    tick: integer('tick').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    severity: text('severity').notNull().default('info'), // info | minor | major | critical
    actors: text('actors', { mode: 'json' }).$type<string[]>().default([]),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    contributionId: text('contribution_id'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index('world_events_planet_tick_idx').on(t.planetId, t.tick)],
);

export const causalLinks = sqliteTable(
  'causal_links',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    causeEventId: text('cause_event_id').notNull().references(() => worldEvents.id),
    effectEventId: text('effect_event_id').notNull().references(() => worldEvents.id),
    relation: text('relation').notNull().default('caused'), // caused | enabled | accelerated | prevented
    strength: real('strength').notNull().default(1),
    explanation: text('explanation'),
  },
  (t) => [index('causal_links_planet_idx').on(t.planetId)],
);

export const timelineSnapshots = sqliteTable(
  'timeline_snapshots',
  {
    id: text('id').primaryKey(),
    planetId: text('planet_id').notNull().references(() => planets.id),
    tick: integer('tick').notNull(),
    year: integer('year').notNull(),
    label: text('label'),
    summary: text('summary'),
    state: text('state', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index('timeline_snapshots_planet_idx').on(t.planetId, t.tick)],
);

export const aiRequests = sqliteTable('ai_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  contributionId: text('contribution_id'),
  provider: text('provider').notNull().default('mock'),
  prompt: text('prompt').notNull(),
  response: text('response', { mode: 'json' }).$type<Record<string, unknown>>(),
  status: text('status').notNull().default('pending'),
  latencyMs: integer('latency_ms'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const moderationResults = sqliteTable('moderation_results', {
  id: text('id').primaryKey(),
  contributionId: text('contribution_id').notNull().references(() => userContributions.id),
  status: text('status').notNull(), // approved | rejected | flagged
  reasons: text('reasons', { mode: 'json' }).$type<string[]>().default([]),
  score: real('score').notNull().default(1),
  reviewerId: text('reviewer_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index('notifications_user_idx').on(t.userId)],
);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  details: text('details', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  ip: text('ip'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  userAgent: text('user_agent'),
  ip: text('ip'),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sessionId: text('session_id').references(() => sessions.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
  replacedById: text('replaced_by_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type User = typeof users.$inferSelect;
export type Planet = typeof planets.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type UserContribution = typeof userContributions.$inferSelect;
export type WorldEvent = typeof worldEvents.$inferSelect;
