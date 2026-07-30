import "dotenv/config";
import { pool } from "./client.js";

const SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'user',
  locale VARCHAR(8) NOT NULL DEFAULT 'ar',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  seed VARCHAR(120) NOT NULL UNIQUE,
  resolution INTEGER NOT NULL DEFAULT 64,
  current_tick INTEGER NOT NULL DEFAULT 0,
  current_year INTEGER NOT NULL DEFAULT -1000,
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planet_regions (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  biome VARCHAR(40) NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  elevation REAL NOT NULL,
  temperature REAL NOT NULL,
  moisture REAL NOT NULL,
  fertility REAL NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  pollution REAL NOT NULL DEFAULT 0,
  civilization_id VARCHAR(64),
  grid_x INTEGER NOT NULL,
  grid_y INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS planet_regions_planet_idx ON planet_regions(planet_id);

CREATE TABLE IF NOT EXISTS civilizations (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  population INTEGER NOT NULL,
  tech_level REAL NOT NULL,
  military REAL NOT NULL,
  economy REAL NOT NULL,
  food REAL NOT NULL,
  stability REAL NOT NULL,
  data JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cities (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civilization_id VARCHAR(64) NOT NULL,
  region_id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  population INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS species (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  population INTEGER NOT NULL,
  traits JSONB DEFAULT '{}',
  contribution_id UUID,
  data JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS plants (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  coverage REAL NOT NULL,
  traits JSONB DEFAULT '{}',
  contribution_id UUID,
  data JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS resources (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  quantity REAL NOT NULL,
  region_id VARCHAR(64) NOT NULL,
  value REAL NOT NULL,
  contribution_id UUID,
  data JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS technologies (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  level REAL NOT NULL,
  data JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS world_events (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  tick INTEGER NOT NULL,
  year INTEGER NOT NULL,
  region_id VARCHAR(64),
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  importance REAL NOT NULL,
  cause TEXT,
  related_entity_ids JSONB DEFAULT '[]',
  contribution_id UUID,
  direct_impact JSONB DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS world_events_planet_tick_idx ON world_events(planet_id, tick);
CREATE INDEX IF NOT EXISTS world_events_type_idx ON world_events(type);

CREATE TABLE IF NOT EXISTS causal_links (
  id VARCHAR(96) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  cause_event_id VARCHAR(64) NOT NULL,
  effect_event_id VARCHAR(64) NOT NULL,
  relation VARCHAR(64) NOT NULL,
  strength REAL NOT NULL,
  delay_ticks INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  planet_id UUID NOT NULL REFERENCES planets(id),
  category VARCHAR(40) NOT NULL,
  raw_text TEXT NOT NULL,
  structured JSONB NOT NULL,
  region_id VARCHAR(64),
  entity_id VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  tick_committed INTEGER,
  year_committed INTEGER,
  impact_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider VARCHAR(40) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  sandbox BOOLEAN NOT NULL DEFAULT TRUE,
  input JSONB NOT NULL,
  output JSONB,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  text_hash VARCHAR(64) NOT NULL,
  blocked BOOLEAN NOT NULL,
  reasons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  kind VARCHAR(64) NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  year INTEGER NOT NULL,
  label VARCHAR(120) NOT NULL,
  label_ar VARCHAR(120) NOT NULL,
  summary TEXT NOT NULL,
  summary_ar TEXT NOT NULL,
  state_blob JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(64),
  target_id VARCHAR(64),
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  year INTEGER NOT NULL,
  events_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(planet_id, tick)
);

CREATE TABLE IF NOT EXISTS wars (
  id VARCHAR(96) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  a VARCHAR(64) NOT NULL,
  b VARCHAR(64) NOT NULL,
  region_id VARCHAR(64),
  intensity REAL NOT NULL,
  tick_started INTEGER NOT NULL,
  ended BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id VARCHAR(96) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_city_id VARCHAR(64) NOT NULL,
  to_city_id VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  distance REAL NOT NULL,
  risk REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  text TEXT NOT NULL,
  structured JSONB NOT NULL,
  provider VARCHAR(40) NOT NULL,
  narrative TEXT,
  narrative_ar TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log("✓ Migrations applied");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
