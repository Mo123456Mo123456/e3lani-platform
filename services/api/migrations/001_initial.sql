CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  locale text NOT NULL DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_url text,
  bio text,
  impact_level integer NOT NULL DEFAULT 0,
  achievements jsonb NOT NULL DEFAULT '[]',
  preferences jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  rotated_from_id uuid REFERENCES refresh_tokens(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planets (
  id uuid PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  seed text UNIQUE NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  tick_years integer NOT NULL DEFAULT 1,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS biomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS planet_regions (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  biome_id uuid REFERENCES biomes(id),
  region_index integer NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  center geography(Point, 4326) NOT NULL,
  boundary geography(Polygon, 4326),
  elevation real NOT NULL,
  temperature real NOT NULL,
  moisture real NOT NULL,
  fertility real NOT NULL,
  population bigint NOT NULL DEFAULT 0,
  carrying_capacity bigint NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}',
  UNIQUE (planet_id, region_index)
);
CREATE INDEX IF NOT EXISTS planet_regions_center_idx ON planet_regions USING gist(center);

CREATE TABLE IF NOT EXISTS climate_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES planet_regions(id) ON DELETE CASCADE,
  tick bigint NOT NULL,
  temperature real NOT NULL,
  pressure real NOT NULL,
  humidity real NOT NULL,
  wind_vector point NOT NULL,
  precipitation real NOT NULL,
  emissions real NOT NULL DEFAULT 0,
  UNIQUE (region_id, tick)
);

CREATE TABLE IF NOT EXISTS species (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  contribution_id uuid,
  kind text NOT NULL CHECK (kind IN ('plant', 'creature')),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  population bigint NOT NULL DEFAULT 0,
  carrying_capacity bigint NOT NULL,
  traits jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_tick bigint NOT NULL,
  extinct_tick bigint
);

CREATE TABLE IF NOT EXISTS plants (
  species_id uuid PRIMARY KEY REFERENCES species(id) ON DELETE CASCADE,
  growth_rate real NOT NULL,
  water_need real NOT NULL,
  pollution_absorption real NOT NULL DEFAULT 0,
  energy_yield real NOT NULL DEFAULT 0,
  biome_codes text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES planet_regions(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  quantity double precision NOT NULL,
  regeneration_rate real NOT NULL,
  extraction_rate real NOT NULL DEFAULT 0,
  value real NOT NULL,
  uses jsonb NOT NULL DEFAULT '[]',
  alternatives jsonb NOT NULL DEFAULT '[]',
  environmental_impact real NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS civilizations (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  population bigint NOT NULL,
  technology real NOT NULL,
  economy real NOT NULL,
  military real NOT NULL,
  stability real NOT NULL,
  health real NOT NULL,
  education real NOT NULL,
  pollution real NOT NULL,
  government text NOT NULL DEFAULT 'council',
  state jsonb NOT NULL DEFAULT '{}',
  founded_tick bigint NOT NULL,
  dissolved_tick bigint
);

CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY,
  civilization_id uuid NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES planet_regions(id),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  location geography(Point, 4326) NOT NULL,
  population bigint NOT NULL,
  economy real NOT NULL,
  defenses real NOT NULL,
  founded_tick bigint NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS cities_location_idx ON cities USING gist(location);

CREATE TABLE IF NOT EXISTS technologies (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  discovered_by uuid REFERENCES civilizations(id),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  level real NOT NULL,
  prerequisites uuid[] NOT NULL DEFAULT '{}',
  effects jsonb NOT NULL DEFAULT '{}',
  discovered_tick bigint
);

CREATE TABLE IF NOT EXISTS languages (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  parent_language_id uuid REFERENCES languages(id),
  speakers bigint NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cultures (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  language_id uuid REFERENCES languages(id),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  values jsonb NOT NULL DEFAULT '{}',
  civilization_ids uuid[] NOT NULL DEFAULT '{}',
  influence real NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_city_id uuid NOT NULL REFERENCES cities(id),
  destination_city_id uuid NOT NULL REFERENCES cities(id),
  path geography(LineString, 4326),
  distance real NOT NULL,
  risk real NOT NULL,
  capacity real NOT NULL,
  goods jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_tick bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS alliances (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  member_ids uuid[] NOT NULL,
  terms jsonb NOT NULL,
  created_tick bigint NOT NULL,
  ended_tick bigint
);

CREATE TABLE IF NOT EXISTS wars (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  attacker_ids uuid[] NOT NULL,
  defender_ids uuid[] NOT NULL,
  cause_event_id uuid,
  objective text NOT NULL,
  start_tick bigint NOT NULL,
  end_tick bigint,
  casualties bigint NOT NULL DEFAULT 0,
  result jsonb,
  state jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS diseases (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  transmissibility real NOT NULL,
  mortality real NOT NULL,
  incubation_days integer NOT NULL,
  resistance real NOT NULL,
  affected_species_ids uuid[] NOT NULL DEFAULT '{}',
  state jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS migrations (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  origin_region_id uuid NOT NULL REFERENCES planet_regions(id),
  destination_region_id uuid NOT NULL REFERENCES planet_regions(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  population bigint NOT NULL,
  path jsonb NOT NULL,
  cause_event_id uuid,
  start_tick bigint NOT NULL,
  end_tick bigint
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  region_id uuid REFERENCES planet_regions(id),
  category text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  structured_traits jsonb NOT NULL,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE species
  DROP CONSTRAINT IF EXISTS species_contribution_fk;
ALTER TABLE species
  ADD CONSTRAINT species_contribution_fk
  FOREIGN KEY (contribution_id) REFERENCES user_contributions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick bigint NOT NULL,
  simulation_year bigint NOT NULL,
  duration_ms integer NOT NULL,
  event_count integer NOT NULL,
  checksum text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  UNIQUE (planet_id, tick)
);

CREATE TABLE IF NOT EXISTS world_events (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  event_type text NOT NULL,
  simulation_year bigint NOT NULL,
  tick bigint NOT NULL,
  region_id uuid,
  contribution_id uuid,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planet_id, sequence)
);
CREATE INDEX IF NOT EXISTS world_events_timeline_idx
  ON world_events(planet_id, simulation_year DESC, sequence DESC);

CREATE TABLE IF NOT EXISTS causal_links (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_event_id uuid NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  to_event_id uuid NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  relation text NOT NULL,
  strength real NOT NULL,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id uuid PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick bigint NOT NULL,
  simulation_year bigint NOT NULL,
  event_sequence bigint NOT NULL,
  checksum text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planet_id, tick)
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  contribution_id uuid REFERENCES user_contributions(id),
  provider text NOT NULL,
  model text NOT NULL,
  purpose text NOT NULL,
  input_hash text NOT NULL,
  structured_output jsonb,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  latency_ms integer,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid REFERENCES user_contributions(id),
  user_id uuid REFERENCES users(id),
  decision text NOT NULL,
  rule_signals jsonb NOT NULL DEFAULT '{}',
  ai_signals jsonb NOT NULL DEFAULT '{}',
  prompt_injection_score real NOT NULL DEFAULT 0,
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_id uuid REFERENCES user_contributions(id),
  event_id uuid REFERENCES world_events(id),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  request_id text,
  ip_hash text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  memory_text text NOT NULL,
  embedding vector(1536),
  importance real NOT NULL DEFAULT 0.5,
  simulation_year bigint NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS world_memory_embedding_idx
  ON world_memory USING hnsw (embedding vector_cosine_ops);
