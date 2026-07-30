CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  impact_score numeric NOT NULL DEFAULT 0,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx ON refresh_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS planets (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  seed text UNIQUE NOT NULL,
  current_tick bigint NOT NULL DEFAULT 0,
  current_year bigint NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 1,
  simulation_status text NOT NULL DEFAULT 'paused',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS biomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS planet_regions (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_index integer NOT NULL,
  location geography(Point, 4326) NOT NULL,
  biome_code text NOT NULL,
  elevation real NOT NULL,
  temperature real NOT NULL,
  moisture real NOT NULL,
  rainfall real NOT NULL,
  fertility real NOT NULL,
  surface_water real NOT NULL,
  vegetation real NOT NULL,
  pollution real NOT NULL DEFAULT 0,
  population bigint NOT NULL DEFAULT 0,
  resources jsonb NOT NULL DEFAULT '{}',
  UNIQUE (planet_id, region_index)
);
CREATE INDEX IF NOT EXISTS planet_regions_location_idx ON planet_regions USING gist(location);

CREATE TABLE IF NOT EXISTS climate_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid UNIQUE NOT NULL REFERENCES planet_regions(id) ON DELETE CASCADE,
  pressure real NOT NULL DEFAULT 0.5,
  wind_x real NOT NULL DEFAULT 0,
  wind_y real NOT NULL DEFAULT 0,
  cloud_cover real NOT NULL DEFAULT 0,
  emissions real NOT NULL DEFAULT 0,
  updated_tick bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS species (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES planet_regions(id),
  name text NOT NULL,
  traits jsonb NOT NULL,
  population bigint NOT NULL CHECK (population >= 0),
  carrying_capacity bigint NOT NULL CHECK (carrying_capacity > 0),
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES planet_regions(id),
  name text NOT NULL,
  traits jsonb NOT NULL,
  population bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES planet_regions(id),
  kind text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity >= 0),
  regeneration_rate numeric NOT NULL DEFAULT 0,
  extraction_rate numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  environmental_impact numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS civilizations (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  capital_region_id uuid NOT NULL REFERENCES planet_regions(id),
  name text NOT NULL,
  state jsonb NOT NULL,
  population bigint NOT NULL CHECK (population > 0),
  founded_year bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id uuid NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES planet_regions(id),
  name text NOT NULL,
  population bigint NOT NULL CHECK (population >= 0),
  is_capital boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id uuid REFERENCES civilizations(id),
  name text NOT NULL,
  level real NOT NULL DEFAULT 0,
  prerequisites jsonb NOT NULL DEFAULT '[]',
  effects jsonb NOT NULL DEFAULT '{}',
  discovered_year bigint
);

CREATE TABLE IF NOT EXISTS cultures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id uuid REFERENCES civilizations(id),
  name text NOT NULL,
  traits jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  culture_id uuid REFERENCES cultures(id) ON DELETE SET NULL,
  name text NOT NULL,
  parent_language_id uuid REFERENCES languages(id),
  vocabulary_seed text NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_city_id uuid NOT NULL REFERENCES cities(id),
  to_city_id uuid NOT NULL REFERENCES cities(id),
  path geography(LineString, 4326),
  goods jsonb NOT NULL DEFAULT '{}',
  risk_score real NOT NULL DEFAULT 0,
  transport_cost numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alliances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  member_ids jsonb NOT NULL DEFAULT '[]',
  formed_year bigint NOT NULL,
  dissolved_year bigint
);

CREATE TABLE IF NOT EXISTS wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  attacker_id uuid NOT NULL REFERENCES civilizations(id),
  defender_id uuid NOT NULL REFERENCES civilizations(id),
  causes jsonb NOT NULL,
  started_year bigint NOT NULL,
  ended_year bigint,
  outcome jsonb
);

CREATE TABLE IF NOT EXISTS diseases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  traits jsonb NOT NULL,
  infected_population bigint NOT NULL DEFAULT 0,
  origin_region_id uuid REFERENCES planet_regions(id)
);

CREATE TABLE IF NOT EXISTS migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_region_id uuid NOT NULL REFERENCES planet_regions(id),
  destination_region_id uuid NOT NULL REFERENCES planet_regions(id),
  population bigint NOT NULL CHECK (population > 0),
  cause text NOT NULL,
  path jsonb NOT NULL,
  started_year bigint NOT NULL,
  completed_year bigint
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  planet_id uuid NOT NULL REFERENCES planets(id),
  region_id uuid NOT NULL REFERENCES planet_regions(id),
  category text NOT NULL,
  name text NOT NULL,
  idea text NOT NULL,
  analysis jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_tick bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, planet_id)
);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick bigint NOT NULL,
  year bigint NOT NULL,
  seed text NOT NULL,
  duration_ms integer NOT NULL,
  event_count integer NOT NULL,
  state_hash text NOT NULL,
  UNIQUE (planet_id, tick)
);

CREATE TABLE IF NOT EXISTS world_events (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  sequence bigserial,
  type text NOT NULL,
  tick bigint NOT NULL,
  year bigint NOT NULL,
  region_id uuid REFERENCES planet_regions(id),
  cause text NOT NULL CHECK (length(cause) > 0),
  actor_ids jsonb NOT NULL DEFAULT '[]',
  payload jsonb NOT NULL DEFAULT '{}',
  confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  direct_impact jsonb NOT NULL DEFAULT '{}',
  root_contribution_id uuid REFERENCES user_contributions(id),
  created_at timestamptz NOT NULL,
  UNIQUE (planet_id, sequence)
);
CREATE INDEX IF NOT EXISTS world_events_timeline_idx ON world_events(planet_id, tick DESC);

CREATE TABLE IF NOT EXISTS causal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_event_id uuid NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  to_event_id uuid NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  relation text NOT NULL,
  strength real NOT NULL CHECK (strength BETWEEN 0 AND 1),
  explanation text NOT NULL,
  UNIQUE (from_event_id, to_event_id, relation)
);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick bigint NOT NULL,
  year bigint NOT NULL,
  version bigint NOT NULL,
  state jsonb NOT NULL,
  state_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planet_id, version)
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  provider text NOT NULL,
  model text NOT NULL,
  purpose text NOT NULL,
  input_hash text NOT NULL,
  output jsonb,
  status text NOT NULL,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid REFERENCES user_contributions(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  decision text NOT NULL,
  rule_hits jsonb NOT NULL DEFAULT '[]',
  classifier_scores jsonb NOT NULL DEFAULT '{}',
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  world_event_id uuid REFERENCES world_events(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  embedding vector(1536),
  created_tick bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS world_memory_embedding_idx
  ON world_memory USING hnsw (embedding vector_cosine_ops);

INSERT INTO roles(name, permissions) VALUES
  ('user', '["world:read","contribution:create"]'),
  ('explorer', '["world:read","timeline:compare"]'),
  ('life_maker', '["world:read","contribution:create"]'),
  ('civilization_creator', '["world:read","contribution:create"]'),
  ('historian', '["world:read","timeline:compare","causal:read"]'),
  ('content_moderator', '["moderation:read","moderation:write"]'),
  ('simulation_manager', '["simulation:read","simulation:run","simulation:rollback"]'),
  ('system_admin', '["admin:read","users:write"]'),
  ('super_admin', '["*"]')
ON CONFLICT (name) DO NOTHING;

INSERT INTO biomes(code, label_ar, label_en) VALUES
  ('ocean','محيط','Ocean'), ('coast','ساحل','Coast'), ('plains','سهول','Plains'),
  ('rainforest','غابات مطيرة','Rainforest'), ('temperate_forest','غابات معتدلة','Temperate forest'),
  ('desert','صحراء','Desert'), ('mountain','جبال','Mountain'), ('tundra','تندرا','Tundra'),
  ('wetland','مستنقعات','Wetland'), ('steppe','سهوب','Steppe'),
  ('volcanic','بركانية','Volcanic'), ('ice','جليدية','Ice')
ON CONFLICT (code) DO NOTHING;
