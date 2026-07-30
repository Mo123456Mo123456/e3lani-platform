BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  preferred_locale TEXT NOT NULL DEFAULT 'ar',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN (
    'user', 'explorer', 'life_maker', 'civilization_creator', 'historian',
    'content_moderator', 'simulation_admin', 'system_admin', 'super_admin'
  ))
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  impact_level INTEGER NOT NULL DEFAULT 0,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planets (
  id TEXT PRIMARY KEY,
  seed TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  current_tick BIGINT NOT NULL DEFAULT 0,
  current_year BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paused',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS biomes (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS planet_regions (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  biome_code TEXT NOT NULL,
  elevation REAL NOT NULL,
  temperature REAL NOT NULL,
  moisture REAL NOT NULL,
  precipitation REAL NOT NULL,
  fertility REAL NOT NULL,
  surface_water REAL NOT NULL,
  vegetation REAL NOT NULL,
  pollution REAL NOT NULL,
  population BIGINT NOT NULL,
  carrying_capacity BIGINT NOT NULL,
  resource_richness REAL NOT NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS planet_regions_center_gist ON planet_regions USING GIST(center);
CREATE INDEX IF NOT EXISTS planet_regions_planet_biome_idx ON planet_regions(planet_id, biome_code);

CREATE TABLE IF NOT EXISTS climate_cells (
  id BIGSERIAL PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES planet_regions(id) ON DELETE CASCADE,
  tick BIGINT NOT NULL,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  pressure REAL NOT NULL,
  wind_x REAL NOT NULL,
  wind_y REAL NOT NULL,
  precipitation REAL NOT NULL,
  emissions REAL NOT NULL DEFAULT 0,
  UNIQUE(region_id, tick)
);

CREATE TABLE IF NOT EXISTS species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  traits JSONB NOT NULL,
  population BIGINT NOT NULL DEFAULT 0,
  habitat_region_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_tick BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  traits JSONB NOT NULL,
  biomass DOUBLE PRECISION NOT NULL DEFAULT 0,
  habitat_region_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_tick BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  regeneration_rate REAL NOT NULL,
  extraction_rate REAL NOT NULL DEFAULT 0,
  value REAL NOT NULL,
  uses JSONB NOT NULL DEFAULT '[]'::jsonb,
  substitutes JSONB NOT NULL DEFAULT '[]'::jsonb,
  environmental_impact REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS civilizations (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  population BIGINT NOT NULL,
  technology REAL NOT NULL,
  economy REAL NOT NULL,
  military REAL NOT NULL,
  stability REAL NOT NULL,
  innovation REAL NOT NULL,
  pollution REAL NOT NULL,
  relations JSONB NOT NULL DEFAULT '{}'::jsonb,
  historical_memory JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id TEXT NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  population BIGINT NOT NULL,
  economy REAL NOT NULL DEFAULT 0,
  health REAL NOT NULL DEFAULT 0.5,
  founded_tick BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS technologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id TEXT REFERENCES civilizations(id),
  name TEXT NOT NULL,
  level REAL NOT NULL,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovered_tick BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS cultures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id TEXT NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  traits JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  culture_id UUID REFERENCES cultures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grammar JSONB NOT NULL DEFAULT '{}'::jsonb,
  speakers BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_city_id UUID NOT NULL REFERENCES cities(id),
  destination_city_id UUID NOT NULL REFERENCES cities(id),
  path GEOGRAPHY(LINESTRING, 4326),
  resource_flows JSONB NOT NULL DEFAULT '{}'::jsonb,
  distance_cost REAL NOT NULL,
  risk_cost REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_ids JSONB NOT NULL,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  formed_tick BIGINT NOT NULL,
  ended_tick BIGINT
);

CREATE TABLE IF NOT EXISTS wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  attacker_ids JSONB NOT NULL,
  defender_ids JSONB NOT NULL,
  causes JSONB NOT NULL,
  losses JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_tick BIGINT NOT NULL,
  ended_tick BIGINT,
  outcome JSONB
);

CREATE TABLE IF NOT EXISTS diseases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  traits JSONB NOT NULL,
  affected_region_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  infected BIGINT NOT NULL DEFAULT 0,
  created_tick BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_region_id TEXT NOT NULL REFERENCES planet_regions(id),
  destination_region_id TEXT NOT NULL REFERENCES planet_regions(id),
  path JSONB NOT NULL,
  population BIGINT NOT NULL,
  causes JSONB NOT NULL,
  started_tick BIGINT NOT NULL,
  ended_tick BIGINT
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES planet_regions(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  structured_traits JSONB NOT NULL,
  possible_biomes JSONB NOT NULL,
  risks JSONB NOT NULL,
  status TEXT NOT NULL,
  created_tick BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id BIGSERIAL PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick BIGINT NOT NULL,
  year BIGINT NOT NULL,
  seed_state TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(planet_id, tick)
);

CREATE TABLE IF NOT EXISTS world_events (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL,
  tick BIGINT NOT NULL,
  year BIGINT NOT NULL,
  type TEXT NOT NULL,
  cause TEXT NOT NULL,
  region_id TEXT REFERENCES planet_regions(id),
  contribution_id TEXT,
  actor_ids JSONB NOT NULL,
  confidence REAL NOT NULL,
  direct_impact JSONB NOT NULL,
  payload JSONB NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(planet_id, sequence)
);
CREATE INDEX IF NOT EXISTS world_events_planet_tick_idx ON world_events(planet_id, tick DESC);
CREATE INDEX IF NOT EXISTS world_events_contribution_idx ON world_events(contribution_id);

CREATE TABLE IF NOT EXISTS causal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  cause_event_id TEXT REFERENCES world_events(id),
  contribution_id TEXT,
  relation TEXT NOT NULL,
  strength REAL NOT NULL,
  explanation_ar TEXT NOT NULL,
  explanation_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick BIGINT NOT NULL,
  year BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(planet_id, tick)
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  sandbox BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id TEXT,
  accepted BOOLEAN NOT NULL,
  flags JSONB NOT NULL,
  reason TEXT,
  classifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  event_id TEXT REFERENCES world_events(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1536),
  created_tick BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS world_memory_entity_idx ON world_memory(planet_id, entity_type, entity_id);

INSERT INTO roles(name, permissions) VALUES
  ('user', '["world:read","contribution:create"]'),
  ('explorer', '["world:read","timeline:compare"]'),
  ('life_maker', '["world:read","contribution:create","species:create"]'),
  ('civilization_creator', '["world:read","contribution:create","civilization:create"]'),
  ('historian', '["world:read","timeline:compare","event:inspect"]'),
  ('content_moderator', '["moderation:review"]'),
  ('simulation_admin', '["simulation:tick","simulation:rollback"]'),
  ('system_admin', '["system:monitor","user:manage"]'),
  ('super_admin', '["*"]')
ON CONFLICT (name) DO NOTHING;

INSERT INTO biomes(code, name_ar, name_en) VALUES
  ('ocean', 'محيط', 'Ocean'),
  ('coast', 'ساحل', 'Coast'),
  ('plains', 'سهول', 'Plains'),
  ('rainforest', 'غابة مطيرة', 'Rainforest'),
  ('temperate_forest', 'غابة معتدلة', 'Temperate forest'),
  ('desert', 'صحراء', 'Desert'),
  ('mountains', 'جبال', 'Mountains'),
  ('tundra', 'تندرا', 'Tundra'),
  ('wetlands', 'أراض رطبة', 'Wetlands'),
  ('steppe', 'سهوب', 'Steppe'),
  ('volcanic', 'منطقة بركانية', 'Volcanic'),
  ('ice', 'أراض جليدية', 'Ice')
ON CONFLICT (code) DO NOTHING;

COMMIT;
