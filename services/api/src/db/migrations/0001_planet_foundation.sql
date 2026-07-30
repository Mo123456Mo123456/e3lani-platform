-- pgcrypto is required for UUID defaults. PostgreSQL 13+ also exposes
-- gen_random_uuid() in core, but the extension keeps older managed images safe.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Spatial/vector columns are deliberately represented by portable JSONB/float
-- columns in this baseline. These optional extensions are enabled when the
-- database operator allows them; a later online migration can add GIST/HNSW
-- indexes without making initial boot fail on restricted managed PostgreSQL.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
  WHEN insufficient_privilege OR undefined_file THEN
    RAISE NOTICE 'PostGIS unavailable; portable latitude/longitude columns remain active';
END $$;
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN insufficient_privilege OR undefined_file THEN
    RAISE NOTICE 'pgvector unavailable; JSONB/array grounding remains active';
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(80) NOT NULL,
  locale varchar(16) NOT NULL DEFAULT 'ar',
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(32) NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  slug varchar(120) NOT NULL UNIQUE,
  seed integer NOT NULL,
  current_tick integer NOT NULL DEFAULT 0 CHECK (current_tick >= 0),
  is_paused boolean NOT NULL DEFAULT false,
  stability double precision NOT NULL DEFAULT 0.7 CHECK (stability BETWEEN 0 AND 1),
  biodiversity double precision NOT NULL DEFAULT 0.8 CHECK (biodiversity BETWEEN 0 AND 1),
  average_temperature double precision NOT NULL DEFAULT 18,
  population bigint NOT NULL DEFAULT 0 CHECK (population >= 0),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS biomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  climate_type varchar(80) NOT NULL,
  carrying_capacity bigint NOT NULL DEFAULT 0,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planet_id, name)
);
CREATE TABLE IF NOT EXISTS planet_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  biome_id uuid REFERENCES biomes(id) ON DELETE SET NULL,
  name varchar(120) NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  area_km2 double precision NOT NULL CHECK (area_km2 > 0),
  population bigint NOT NULL DEFAULT 0 CHECK (population >= 0),
  stability double precision NOT NULL DEFAULT 0.7 CHECK (stability BETWEEN 0 AND 1),
  geography jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planet_id, name)
);
CREATE TABLE IF NOT EXISTS climate_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid REFERENCES planet_regions(id) ON DELETE CASCADE,
  grid_x integer NOT NULL,
  grid_y integer NOT NULL,
  temperature double precision NOT NULL,
  precipitation double precision NOT NULL CHECK (precipitation >= 0),
  atmospheric_carbon double precision NOT NULL CHECK (atmospheric_carbon >= 0),
  tick integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planet_id, grid_x, grid_y, tick)
);
CREATE TABLE IF NOT EXISTS species (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid REFERENCES planet_regions(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  taxonomy varchar(120) NOT NULL,
  population bigint NOT NULL DEFAULT 0 CHECK (population >= 0),
  conservation_status varchar(40) NOT NULL DEFAULT 'stable',
  traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid REFERENCES planet_regions(id) ON DELETE SET NULL,
  biome_id uuid REFERENCES biomes(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  abundance double precision NOT NULL DEFAULT 0.5 CHECK (abundance BETWEEN 0 AND 1),
  edible boolean NOT NULL DEFAULT false,
  traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid REFERENCES planet_regions(id) ON DELETE SET NULL,
  name varchar(140) NOT NULL,
  category varchar(80) NOT NULL,
  quantity double precision NOT NULL CHECK (quantity >= 0),
  renewability double precision NOT NULL DEFAULT 0 CHECK (renewability BETWEEN 0 AND 1),
  strategic_value double precision NOT NULL DEFAULT 0.5 CHECK (strategic_value BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civilizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  home_region_id uuid REFERENCES planet_regions(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  government varchar(100) NOT NULL,
  population bigint NOT NULL DEFAULT 0 CHECK (population >= 0),
  prosperity double precision NOT NULL DEFAULT 0.5 CHECK (prosperity BETWEEN 0 AND 1),
  stability double precision NOT NULL DEFAULT 0.5 CHECK (stability BETWEEN 0 AND 1),
  founded_tick integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id uuid NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  region_id uuid REFERENCES planet_regions(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  population bigint NOT NULL DEFAULT 0 CHECK (population >= 0),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  founded_tick integer NOT NULL DEFAULT 0,
  infrastructure jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  domain varchar(80) NOT NULL,
  level integer NOT NULL DEFAULT 1 CHECK (level > 0),
  discovered_tick integer NOT NULL,
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planet_id, name)
);
CREATE TABLE IF NOT EXISTS civilization_technologies (
  civilization_id uuid NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  adoption double precision NOT NULL DEFAULT 0 CHECK (adoption BETWEEN 0 AND 1),
  acquired_tick integer NOT NULL,
  PRIMARY KEY (civilization_id, technology_id)
);
CREATE TABLE IF NOT EXISTS cultures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id uuid REFERENCES civilizations(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  influence double precision NOT NULL DEFAULT 0.5 CHECK (influence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  culture_id uuid REFERENCES cultures(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  speakers bigint NOT NULL DEFAULT 0 CHECK (speakers >= 0),
  family varchar(120) NOT NULL,
  writing_system varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trade_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  destination_city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL DEFAULT 'active',
  volume double precision NOT NULL DEFAULT 0 CHECK (volume >= 0),
  goods jsonb NOT NULL DEFAULT '[]'::jsonb,
  established_tick integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (origin_city_id <> destination_city_id)
);
CREATE TABLE IF NOT EXISTS alliances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  member_civilization_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'active',
  started_tick integer NOT NULL,
  ended_tick integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  belligerent_civilization_ids jsonb NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  casualties bigint NOT NULL DEFAULT 0 CHECK (casualties >= 0),
  started_tick integer NOT NULL,
  ended_tick integer,
  causes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS diseases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  pathogen_type varchar(80) NOT NULL,
  transmissibility double precision NOT NULL CHECK (transmissibility BETWEEN 0 AND 1),
  mortality_rate double precision NOT NULL CHECK (mortality_rate BETWEEN 0 AND 1),
  affected_region_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'active',
  emerged_tick integer NOT NULL,
  contained_tick integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_region_id uuid REFERENCES planet_regions(id) ON DELETE SET NULL,
  destination_region_id uuid REFERENCES planet_regions(id) ON DELETE SET NULL,
  civilization_id uuid REFERENCES civilizations(id) ON DELETE SET NULL,
  population bigint NOT NULL CHECK (population > 0),
  cause varchar(160) NOT NULL,
  started_tick integer NOT NULL,
  ended_tick integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  proposal text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'accepted',
  analysis jsonb NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  committed_tick integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_contributions_user_planet_idempotency
    UNIQUE (user_id, planet_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS simulation_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick integer NOT NULL CHECK (tick >= 0),
  status varchar(32) NOT NULL DEFAULT 'committed',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT simulation_ticks_planet_tick UNIQUE (planet_id, tick)
);
CREATE TABLE IF NOT EXISTS world_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  contribution_id uuid REFERENCES user_contributions(id) ON DELETE SET NULL,
  tick integer NOT NULL CHECK (tick >= 0),
  title varchar(160) NOT NULL,
  summary text NOT NULL,
  category varchar(80) NOT NULL,
  magnitude double precision NOT NULL CHECK (magnitude BETWEEN 0 AND 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_retracted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS causal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  source_event_id uuid NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  target_event_id uuid NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  relation varchar(80) NOT NULL DEFAULT 'influenced',
  strength double precision NOT NULL DEFAULT 0.5 CHECK (strength BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT causal_links_source_target UNIQUE (source_event_id, target_event_id),
  CHECK (source_event_id <> target_event_id)
);
CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick integer NOT NULL CHECK (tick >= 0),
  reason varchar(120) NOT NULL,
  state jsonb NOT NULL,
  checksum varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timeline_snapshots_planet_tick UNIQUE (planet_id, tick)
);
CREATE TABLE IF NOT EXISTS ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  planet_id uuid REFERENCES planets(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  model varchar(120) NOT NULL,
  prompt_hash varchar(64) NOT NULL,
  status varchar(32) NOT NULL,
  response jsonb,
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS moderation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_request_id uuid REFERENCES ai_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  allowed boolean NOT NULL,
  risk varchar(32) NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planet_id uuid REFERENCES planets(id) ON DELETE CASCADE,
  type varchar(80) NOT NULL,
  title varchar(160) NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roles (name, description) VALUES
  ('guest', 'Read-only unauthenticated capability marker'),
  ('user', 'May explore the world and submit contributions'),
  ('explorer', 'May inspect advanced world layers'),
  ('life_maker', 'May create reviewed biological contributions'),
  ('civilization_creator', 'May create reviewed civilization contributions'),
  ('historian', 'May inspect and annotate world history'),
  ('moderator', 'May review contributions and moderation results'),
  ('content_moderator', 'May review user-generated content'),
  ('simulation_manager', 'May control ticks and restore snapshots'),
  ('admin', 'Backward-compatible administrative role'),
  ('system_admin', 'May operate platform infrastructure'),
  ('super_admin', 'Full sandbox or production administrative access')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS auth_sessions_active_idx ON auth_sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS regions_planet_idx ON planet_regions(planet_id);
CREATE INDEX IF NOT EXISTS species_planet_region_idx ON species(planet_id, region_id);
CREATE INDEX IF NOT EXISTS plants_planet_region_idx ON plants(planet_id, region_id);
CREATE INDEX IF NOT EXISTS resources_planet_region_idx ON resources(planet_id, region_id);
CREATE INDEX IF NOT EXISTS civilizations_planet_idx ON civilizations(planet_id);
CREATE INDEX IF NOT EXISTS cities_planet_civilization_idx ON cities(planet_id, civilization_id);
CREATE INDEX IF NOT EXISTS world_events_planet_tick_idx ON world_events(planet_id, tick DESC)
  WHERE is_retracted = false;
CREATE INDEX IF NOT EXISTS snapshots_planet_tick_idx ON timeline_snapshots(planet_id, tick DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs(actor_user_id, created_at DESC);
