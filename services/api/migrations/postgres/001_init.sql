-- Postgres + PostGIS parallel migrations for production
-- Apply with: psql $DATABASE_URL -f migrations/postgres/001_init.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  bio TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'ar',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS planets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seed TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  age_years INTEGER NOT NULL DEFAULT 0,
  current_tick INTEGER NOT NULL DEFAULT 0,
  resolution INTEGER NOT NULL DEFAULT 64,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS biomes (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT,
  habitability REAL NOT NULL DEFAULT 0.5,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS planet_regions (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  elevation REAL NOT NULL DEFAULT 0,
  moisture REAL NOT NULL DEFAULT 0.5,
  temperature REAL NOT NULL DEFAULT 15,
  biome_id TEXT,
  geom GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS planet_regions_planet_idx ON planet_regions(planet_id);

CREATE TABLE IF NOT EXISTS climate_cells (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  region_id TEXT REFERENCES planet_regions(id),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  wind_speed REAL NOT NULL DEFAULT 0,
  pressure REAL NOT NULL DEFAULT 1013,
  tick INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  scientific_name TEXT,
  growth_rate REAL NOT NULL DEFAULT 1,
  coverage REAL NOT NULL DEFAULT 0.1,
  biome_id TEXT,
  region_id TEXT,
  status TEXT NOT NULL DEFAULT 'abundant',
  traits JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS species (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  scientific_name TEXT,
  kingdom TEXT NOT NULL DEFAULT 'animalia',
  trophic_level INTEGER NOT NULL DEFAULT 2,
  population INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'thriving',
  depends_on_plant_id TEXT,
  region_id TEXT,
  traits JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  abundance REAL NOT NULL DEFAULT 0.5,
  renewability REAL NOT NULL DEFAULT 0,
  region_id TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cultures (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  civilization_id TEXT,
  name TEXT NOT NULL,
  "values" JSONB DEFAULT '[]',
  arts JSONB DEFAULT '[]',
  religion TEXT
);

CREATE TABLE IF NOT EXISTS languages (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  family TEXT,
  script TEXT,
  speakers INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS civilizations (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  era TEXT NOT NULL DEFAULT 'stone',
  population INTEGER NOT NULL DEFAULT 10000,
  tech_level REAL NOT NULL DEFAULT 0.1,
  culture_id TEXT,
  language_id TEXT,
  capital_city_id TEXT,
  status TEXT NOT NULL DEFAULT 'rising',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  civilization_id TEXT NOT NULL REFERENCES civilizations(id),
  name TEXT NOT NULL,
  region_id TEXT,
  population INTEGER NOT NULL DEFAULT 1000,
  prosperity REAL NOT NULL DEFAULT 0.5,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  is_capital BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technologies (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  civilization_id TEXT REFERENCES civilizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  level INTEGER NOT NULL DEFAULT 1,
  discovered_at_tick INTEGER NOT NULL DEFAULT 0,
  effects JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  from_city_id TEXT NOT NULL REFERENCES cities(id),
  to_city_id TEXT NOT NULL REFERENCES cities(id),
  resource_id TEXT REFERENCES resources(id),
  volume REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS alliances (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  civ_a_id TEXT NOT NULL REFERENCES civilizations(id),
  civ_b_id TEXT NOT NULL REFERENCES civilizations(id),
  strength REAL NOT NULL DEFAULT 0.5,
  formed_at_tick INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS wars (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  aggressor_id TEXT NOT NULL REFERENCES civilizations(id),
  defender_id TEXT NOT NULL REFERENCES civilizations(id),
  cause TEXT,
  started_at_tick INTEGER NOT NULL DEFAULT 0,
  ended_at_tick INTEGER,
  status TEXT NOT NULL DEFAULT 'ongoing',
  casualties INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS diseases (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  virulence REAL NOT NULL DEFAULT 0.3,
  spread_rate REAL NOT NULL DEFAULT 0.1,
  mortality REAL NOT NULL DEFAULT 0.05,
  affected_species_id TEXT,
  affected_civ_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  discovered_at_tick INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_region_id TEXT,
  to_region_id TEXT,
  tick INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  population_moved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  planet_id TEXT NOT NULL REFERENCES planets(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  analysis JSONB,
  balance_score REAL,
  injected_at_tick INTEGER,
  injected_entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  tick INTEGER NOT NULL,
  year INTEGER NOT NULL,
  delta_summary JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(planet_id, tick)
);

CREATE TABLE IF NOT EXISTS world_events (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  tick INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  actors JSONB DEFAULT '[]',
  payload JSONB DEFAULT '{}',
  contribution_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS world_events_planet_tick_idx ON world_events(planet_id, tick);

CREATE TABLE IF NOT EXISTS causal_links (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  cause_event_id TEXT NOT NULL REFERENCES world_events(id),
  effect_event_id TEXT NOT NULL REFERENCES world_events(id),
  relation TEXT NOT NULL DEFAULT 'caused',
  strength REAL NOT NULL DEFAULT 1,
  explanation TEXT
);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  tick INTEGER NOT NULL,
  year INTEGER NOT NULL,
  label TEXT,
  summary TEXT,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  contribution_id TEXT,
  provider TEXT NOT NULL DEFAULT 'mock',
  prompt TEXT NOT NULL,
  response JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id TEXT PRIMARY KEY,
  contribution_id TEXT NOT NULL REFERENCES user_contributions(id),
  status TEXT NOT NULL,
  reasons JSONB DEFAULT '[]',
  score REAL NOT NULL DEFAULT 1,
  reviewer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_agent TEXT,
  ip TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  session_id TEXT REFERENCES sessions(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
