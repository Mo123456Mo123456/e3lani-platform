CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  impact_score NUMERIC(10, 4) NOT NULL DEFAULT 0,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
  bio TEXT
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE planets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  seed TEXT UNIQUE NOT NULL,
  current_tick BIGINT NOT NULL DEFAULT 0,
  current_year BIGINT NOT NULL DEFAULT 0,
  tick_unit TEXT NOT NULL DEFAULT 'year',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'archived')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE biomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  rules JSONB NOT NULL
);

CREATE TABLE planet_regions (
  id TEXT PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  biome_code TEXT NOT NULL REFERENCES biomes(code),
  elevation NUMERIC(7, 4) NOT NULL CHECK (elevation BETWEEN 0 AND 1),
  temperature NUMERIC(7, 4) NOT NULL CHECK (temperature BETWEEN 0 AND 1),
  moisture NUMERIC(7, 4) NOT NULL CHECK (moisture BETWEEN 0 AND 1),
  fertility NUMERIC(7, 4) NOT NULL CHECK (fertility BETWEEN 0 AND 1),
  surface_water NUMERIC(7, 4) NOT NULL CHECK (surface_water BETWEEN 0 AND 1),
  plate_activity NUMERIC(7, 4) NOT NULL CHECK (plate_activity BETWEEN 0 AND 1),
  resource_richness NUMERIC(7, 4) NOT NULL CHECK (resource_richness BETWEEN 0 AND 1),
  carrying_capacity BIGINT NOT NULL CHECK (carrying_capacity >= 0),
  population BIGINT NOT NULL DEFAULT 0 CHECK (population >= 0),
  pollution NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (pollution BETWEEN 0 AND 1),
  biodiversity NUMERIC(7, 4) NOT NULL DEFAULT 0.5 CHECK (biodiversity BETWEEN 0 AND 1),
  economy NUMERIC(18, 4) NOT NULL DEFAULT 0,
  state_version BIGINT NOT NULL DEFAULT 0,
  UNIQUE (planet_id, region_index)
);
CREATE INDEX planet_regions_geo_idx ON planet_regions USING GIST(center);
CREATE INDEX planet_regions_planet_idx ON planet_regions(planet_id);

CREATE TABLE climate_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id TEXT NOT NULL REFERENCES planet_regions(id) ON DELETE CASCADE,
  tick BIGINT NOT NULL,
  temperature NUMERIC(7, 4) NOT NULL,
  moisture NUMERIC(7, 4) NOT NULL,
  pressure NUMERIC(8, 4) NOT NULL,
  wind_vector JSONB NOT NULL,
  precipitation NUMERIC(8, 4) NOT NULL,
  emissions NUMERIC(12, 4) NOT NULL DEFAULT 0,
  UNIQUE (region_id, tick)
);

CREATE TABLE species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  home_region_id TEXT REFERENCES planet_regions(id),
  traits JSONB NOT NULL,
  population BIGINT NOT NULL CHECK (population >= 0),
  extinction_tick BIGINT,
  created_at_tick BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  home_region_id TEXT REFERENCES planet_regions(id),
  traits JSONB NOT NULL,
  population BIGINT NOT NULL CHECK (population >= 0),
  extinction_tick BIGINT,
  created_at_tick BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  quantity NUMERIC(20, 4) NOT NULL CHECK (quantity >= 0),
  regeneration_rate NUMERIC(10, 6) NOT NULL DEFAULT 0,
  extraction_rate NUMERIC(10, 6) NOT NULL DEFAULT 0,
  value NUMERIC(14, 4) NOT NULL DEFAULT 0,
  uses JSONB NOT NULL DEFAULT '[]'::jsonb,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  environmental_impact NUMERIC(7, 4) NOT NULL DEFAULT 0
);

CREATE TABLE cultures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  values JSONB NOT NULL,
  origin_tick BIGINT NOT NULL
);

CREATE TABLE languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  features JSONB NOT NULL,
  origin_tick BIGINT NOT NULL
);

CREATE TABLE civilizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capital_region_id TEXT REFERENCES planet_regions(id),
  culture_id UUID REFERENCES cultures(id),
  language_id UUID REFERENCES languages(id),
  population BIGINT NOT NULL CHECK (population > 0),
  government TEXT NOT NULL,
  technology_level NUMERIC(7, 4) NOT NULL,
  military_power NUMERIC(14, 4) NOT NULL,
  economy NUMERIC(18, 4) NOT NULL,
  health NUMERIC(7, 4) NOT NULL,
  stability NUMERIC(7, 4) NOT NULL,
  education NUMERIC(7, 4) NOT NULL,
  pollution NUMERIC(7, 4) NOT NULL,
  happiness NUMERIC(7, 4) NOT NULL,
  innovation NUMERIC(7, 4) NOT NULL,
  strategic_memory JSONB NOT NULL DEFAULT '[]'::jsonb,
  founded_tick BIGINT NOT NULL
);

CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id UUID NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  name TEXT NOT NULL,
  population BIGINT NOT NULL CHECK (population > 0),
  food_stock NUMERIC(18, 4) NOT NULL DEFAULT 0,
  infrastructure NUMERIC(7, 4) NOT NULL DEFAULT 0.2,
  founded_tick BIGINT NOT NULL
);

CREATE TABLE technologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id UUID REFERENCES civilizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  level NUMERIC(7, 4) NOT NULL,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovered_tick BIGINT NOT NULL
);

CREATE TABLE trade_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_city_id UUID NOT NULL REFERENCES cities(id),
  destination_city_id UUID NOT NULL REFERENCES cities(id),
  path JSONB NOT NULL,
  distance NUMERIC(14, 4) NOT NULL,
  risk NUMERIC(7, 4) NOT NULL,
  volume NUMERIC(18, 4) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  formed_tick BIGINT NOT NULL,
  ended_tick BIGINT
);

CREATE TABLE alliance_members (
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  civilization_id UUID NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  joined_tick BIGINT NOT NULL,
  left_tick BIGINT,
  PRIMARY KEY (alliance_id, civilization_id)
);

CREATE TABLE wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  aggressor_id UUID NOT NULL REFERENCES civilizations(id),
  defender_id UUID NOT NULL REFERENCES civilizations(id),
  cause JSONB NOT NULL,
  started_tick BIGINT NOT NULL,
  ended_tick BIGINT,
  casualties BIGINT NOT NULL DEFAULT 0,
  outcome JSONB
);

CREATE TABLE diseases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  origin_region_id TEXT REFERENCES planet_regions(id),
  traits JSONB NOT NULL,
  infected_population BIGINT NOT NULL DEFAULT 0,
  emerged_tick BIGINT NOT NULL,
  eradicated_tick BIGINT
);

CREATE TABLE migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_region_id TEXT NOT NULL REFERENCES planet_regions(id),
  destination_region_id TEXT NOT NULL REFERENCES planet_regions(id),
  path JSONB NOT NULL,
  population BIGINT NOT NULL CHECK (population > 0),
  cause TEXT NOT NULL,
  started_tick BIGINT NOT NULL,
  ended_tick BIGINT
);

CREATE TABLE user_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  planet_id UUID NOT NULL REFERENCES planets(id),
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  original_idea TEXT NOT NULL,
  structured_traits JSONB NOT NULL,
  risks JSONB NOT NULL,
  analysis_metadata JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected', 'extinct')),
  introduced_tick BIGINT,
  idempotency_key UUID UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE simulation_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id),
  tick BIGINT NOT NULL,
  year BIGINT NOT NULL,
  seed TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'committed', 'failed')),
  duration_ms INTEGER,
  event_count INTEGER NOT NULL DEFAULT 0,
  state_checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (planet_id, tick)
);

CREATE TABLE world_events (
  id TEXT PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick BIGINT NOT NULL,
  year BIGINT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  cause TEXT NOT NULL CHECK (length(cause) > 0),
  direct_effects JSONB NOT NULL,
  importance NUMERIC(7, 4) NOT NULL CHECK (importance BETWEEN 0 AND 1),
  confidence NUMERIC(7, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  contribution_id UUID REFERENCES user_contributions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX world_events_timeline_idx ON world_events(planet_id, tick DESC);
CREATE INDEX world_events_region_idx ON world_events(region_id, tick DESC);

CREATE TABLE causal_links (
  id TEXT PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  target_event_id TEXT NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  mechanism TEXT NOT NULL,
  strength NUMERIC(7, 4) NOT NULL CHECK (strength BETWEEN 0 AND 1)
);

CREATE TABLE timeline_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick BIGINT NOT NULL,
  year BIGINT NOT NULL,
  state JSONB NOT NULL,
  checksum TEXT NOT NULL,
  object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (planet_id, tick)
);

CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider TEXT NOT NULL,
  model TEXT,
  purpose TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output JSONB,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(12, 6),
  sandbox BOOLEAN NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE moderation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID REFERENCES user_contributions(id) ON DELETE CASCADE,
  input_hash TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'review', 'block')),
  rule_hits JSONB NOT NULL DEFAULT '[]'::jsonb,
  classifier JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES world_events(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE world_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding VECTOR(1536),
  created_tick BIGINT NOT NULL,
  UNIQUE (planet_id, entity_type, entity_id, created_tick)
);
CREATE INDEX world_memory_embedding_idx ON world_memory USING hnsw (embedding vector_cosine_ops);
