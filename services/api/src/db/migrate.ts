import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'user',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  locale VARCHAR(8) NOT NULL DEFAULT 'ar',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  elements_added INTEGER NOT NULL DEFAULT 0,
  total_impacts INTEGER NOT NULL DEFAULT 0,
  impact_age_days INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS planets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  name_ar VARCHAR(128) NOT NULL,
  seed INTEGER NOT NULL,
  tick INTEGER NOT NULL DEFAULT 0,
  year DOUBLE PRECISION NOT NULL DEFAULT 0,
  tick_unit VARCHAR(16) NOT NULL DEFAULT 'year',
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planet_regions (
  id VARCHAR(64) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  name_ar VARCHAR(128) NOT NULL,
  biome VARCHAR(64) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  elevation DOUBLE PRECISION NOT NULL,
  temperature DOUBLE PRECISION NOT NULL,
  moisture DOUBLE PRECISION NOT NULL,
  fertility DOUBLE PRECISION NOT NULL,
  pollution DOUBLE PRECISION NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS planet_regions_planet_idx ON planet_regions(planet_id);

CREATE TABLE IF NOT EXISTS world_events (
  id VARCHAR(128) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  tick INTEGER NOT NULL,
  year DOUBLE PRECISION NOT NULL,
  region_id VARCHAR(64),
  importance DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  causes JSONB NOT NULL,
  effects JSONB NOT NULL,
  contribution_id UUID,
  actor_ids JSONB NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS world_events_planet_tick_idx ON world_events(planet_id, tick);
CREATE INDEX IF NOT EXISTS world_events_type_idx ON world_events(type);

CREATE TABLE IF NOT EXISTS causal_links (
  id VARCHAR(256) PRIMARY KEY,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_event_id VARCHAR(128) NOT NULL,
  to_event_id VARCHAR(128) NOT NULL,
  relation VARCHAR(64) NOT NULL,
  strength DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  description_ar TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  name_ar VARCHAR(128) NOT NULL,
  idea TEXT NOT NULL,
  region_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  structured JSONB,
  preview JSONB,
  entity_id VARCHAR(128),
  applied_tick INTEGER,
  narrative TEXT,
  narrative_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_contributions_user_idx ON user_contributions(user_id);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  year DOUBLE PRECISION NOT NULL,
  label VARCHAR(128),
  label_ar VARCHAR(128),
  state_hash VARCHAR(64) NOT NULL,
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS timeline_snapshots_planet_tick_idx ON timeline_snapshots(planet_id, tick);

CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider VARCHAR(32) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  sandbox BOOLEAN NOT NULL DEFAULT TRUE,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  reasons JSONB NOT NULL,
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
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action VARCHAR(128) NOT NULL,
  target_type VARCHAR(64),
  target_id VARCHAR(128),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  year DOUBLE PRECISION NOT NULL,
  event_count INTEGER NOT NULL,
  metrics JSONB NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS simulation_ticks_planet_idx ON simulation_ticks(planet_id, tick);
`;

async function main() {
  // Ensure pgcrypto for gen_random_uuid
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await pool.query(SQL);
  await pool.query(
    `INSERT INTO schema_migrations (id) VALUES ('001_init') ON CONFLICT DO NOTHING`,
  );
  console.log("✓ Migrations applied");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
