import { pool } from "./client.js";

const statements = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  locale text NOT NULL DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio text,
  avatar_url text,
  impact_score real NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text NOT NULL,
  seed integer NOT NULL,
  current_tick integer NOT NULL DEFAULT 0,
  current_year integer NOT NULL DEFAULT 0,
  tick_unit text NOT NULL DEFAULT 'year',
  status text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planet_regions (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text NOT NULL,
  biome text NOT NULL,
  lat real NOT NULL,
  lng real NOT NULL,
  x integer NOT NULL,
  y integer NOT NULL,
  elevation real NOT NULL,
  temperature real NOT NULL,
  moisture real NOT NULL,
  fertility real NOT NULL,
  pollution real NOT NULL DEFAULT 0,
  population integer NOT NULL DEFAULT 0,
  carrying_capacity integer NOT NULL DEFAULT 0,
  civilization_id text
);
CREATE INDEX IF NOT EXISTS regions_planet_idx ON planet_regions(planet_id);

CREATE TABLE IF NOT EXISTS species (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text NOT NULL,
  population integer NOT NULL,
  traits jsonb NOT NULL,
  preferred_biomes jsonb NOT NULL,
  contribution_id uuid
);

CREATE TABLE IF NOT EXISTS plants (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text NOT NULL,
  coverage real NOT NULL,
  traits jsonb NOT NULL,
  preferred_biomes jsonb NOT NULL,
  contribution_id uuid
);

CREATE TABLE IF NOT EXISTS resources (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  region_id text NOT NULL,
  name text NOT NULL,
  name_en text NOT NULL,
  quantity real NOT NULL,
  value real NOT NULL,
  renewal real NOT NULL
);

CREATE TABLE IF NOT EXISTS civilizations (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text NOT NULL,
  population integer NOT NULL,
  stats jsonb NOT NULL,
  capital_region_id text NOT NULL,
  memory jsonb NOT NULL DEFAULT '[]',
  contribution_id uuid
);

CREATE TABLE IF NOT EXISTS cities (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id text NOT NULL,
  region_id text NOT NULL,
  name text NOT NULL,
  name_en text NOT NULL,
  population integer NOT NULL
);

CREATE TABLE IF NOT EXISTS technologies (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text NOT NULL,
  level real NOT NULL,
  civilization_ids jsonb NOT NULL,
  contribution_id uuid
);

CREATE TABLE IF NOT EXISTS cultures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  civilization_id text
);

CREATE TABLE IF NOT EXISTS languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  civilization_id text
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_city_id text NOT NULL,
  to_city_id text NOT NULL,
  risk real NOT NULL,
  value real NOT NULL
);

CREATE TABLE IF NOT EXISTS alliances (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  a_id text NOT NULL,
  b_id text NOT NULL,
  formed_tick integer NOT NULL
);

CREATE TABLE IF NOT EXISTS wars (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  a_id text NOT NULL,
  b_id text NOT NULL,
  region_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  started_tick integer NOT NULL,
  strength real NOT NULL
);

CREATE TABLE IF NOT EXISTS diseases (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name text NOT NULL,
  infectivity real NOT NULL,
  severity real NOT NULL,
  region_ids jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS migrations (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_region_id text NOT NULL,
  to_region_id text NOT NULL,
  population integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  reason text NOT NULL,
  started_tick integer NOT NULL
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,
  idea text NOT NULL,
  structured jsonb NOT NULL,
  region_id text NOT NULL,
  applied_tick integer NOT NULL,
  status text NOT NULL DEFAULT 'applied',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick integer NOT NULL,
  year integer NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_events (
  id text PRIMARY KEY,
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  title_en text NOT NULL,
  summary text NOT NULL,
  summary_en text NOT NULL,
  tick integer NOT NULL,
  year integer NOT NULL,
  importance real NOT NULL,
  region_id text,
  lat real,
  lng real,
  causes jsonb NOT NULL,
  effects jsonb NOT NULL,
  contribution_id uuid,
  user_id uuid,
  confidence real NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_planet_tick_idx ON world_events(planet_id, tick);

CREATE TABLE IF NOT EXISTS causal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  contribution_id uuid,
  graph jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id uuid NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  label text NOT NULL,
  tick integer NOT NULL,
  year integer NOT NULL,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  provider text NOT NULL,
  sandbox boolean NOT NULL,
  purpose text NOT NULL,
  input jsonb NOT NULL,
  output jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  content text NOT NULL,
  allowed boolean NOT NULL,
  reasons jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_state_blobs (
  planet_id uuid PRIMARY KEY REFERENCES planets(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

async function main() {
  await pool.query(statements);
  console.log("Migrations applied.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
