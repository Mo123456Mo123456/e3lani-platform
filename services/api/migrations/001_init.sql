-- Planet Genesis — initial schema (PostgreSQL 16+)
-- Every domain entity from the product spec has a table. The hot simulation
-- path is event-sourced (world_events + timeline_snapshots); per-entity
-- simulation tables (species, civilizations, cities, ...) hold the latest
-- denormalized state refreshed at each snapshot for browsing/admin queries.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- PostGIS / pgvector are optional in this phase; enable when available:
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- users & auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  name        TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'email',
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL REFERENCES roles(name),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio          TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT,
  locale       TEXT NOT NULL DEFAULT 'ar',
  impact_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  family_id   UUID NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens (family_id);

-- ---------------------------------------------------------------------------
-- planet & simulation core
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planets (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  seed         TEXT NOT NULL,
  lat_bands    INT NOT NULL,
  lon_bands    INT NOT NULL,
  sea_level    DOUBLE PRECISION NOT NULL,
  current_tick BIGINT NOT NULL DEFAULT 0,
  current_year BIGINT NOT NULL DEFAULT 0,
  years_per_tick INT NOT NULL DEFAULT 5,
  river_count  INT,
  resource_density DOUBLE PRECISION,
  status       TEXT NOT NULL DEFAULT 'paused',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planet_regions (
  planet_id   TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  cell        INT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL,
  height      DOUBLE PRECISION NOT NULL,
  temperature DOUBLE PRECISION NOT NULL,
  moisture    DOUBLE PRECISION NOT NULL,
  biome       TEXT NOT NULL,
  fertility   DOUBLE PRECISION NOT NULL,
  pollution   DOUBLE PRECISION NOT NULL DEFAULT 0,
  river       BOOLEAN NOT NULL DEFAULT FALSE,
  volcanic    BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id    TEXT,
  PRIMARY KEY (planet_id, cell)
);
CREATE INDEX IF NOT EXISTS planet_regions_owner_idx ON planet_regions (owner_id);

CREATE TABLE IF NOT EXISTS biomes (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS climate_cells (
  planet_id   TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  cell        INT NOT NULL,
  tick        BIGINT NOT NULL,
  temperature DOUBLE PRECISION NOT NULL,
  moisture    DOUBLE PRECISION NOT NULL,
  pollution   DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (planet_id, cell, tick)
);

CREATE TABLE IF NOT EXISTS species (
  id            TEXT NOT NULL,
  planet_id     TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  diet          TEXT NOT NULL,
  traits        JSONB NOT NULL,
  population    BIGINT NOT NULL,
  habitat       JSONB NOT NULL,
  origin_cell   INT NOT NULL,
  born_at_tick  BIGINT NOT NULL,
  extinct_at_tick BIGINT,
  parent_species_id TEXT,
  origin_contribution_id UUID,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS plants (
  id            TEXT NOT NULL,
  planet_id     TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  traits        JSONB NOT NULL,
  suitable_biomes JSONB NOT NULL,
  coverage      JSONB NOT NULL,
  born_at_tick  BIGINT NOT NULL,
  origin_contribution_id UUID,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS resources (
  id          TEXT NOT NULL,
  planet_id   TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  cell        INT NOT NULL,
  type        TEXT NOT NULL,
  quantity    DOUBLE PRECISION NOT NULL,
  renew_rate  DOUBLE PRECISION NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  discovered  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (planet_id, id)
);
CREATE INDEX IF NOT EXISTS resources_cell_idx ON resources (planet_id, cell);

CREATE TABLE IF NOT EXISTS civilizations (
  id           TEXT NOT NULL,
  planet_id    TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,
  population   BIGINT NOT NULL,
  government   TEXT NOT NULL,
  tech_level   DOUBLE PRECISION NOT NULL,
  military     DOUBLE PRECISION NOT NULL,
  food         DOUBLE PRECISION NOT NULL,
  economy      DOUBLE PRECISION NOT NULL,
  health       DOUBLE PRECISION NOT NULL,
  stability    DOUBLE PRECISION NOT NULL,
  education    DOUBLE PRECISION NOT NULL,
  happiness    DOUBLE PRECISION NOT NULL,
  pollution    DOUBLE PRECISION NOT NULL,
  aggression   DOUBLE PRECISION NOT NULL,
  innovation   DOUBLE PRECISION NOT NULL,
  relations    JSONB NOT NULL DEFAULT '{}',
  memory       JSONB NOT NULL DEFAULT '{}',
  founded_at_tick BIGINT NOT NULL,
  collapsed_at_tick BIGINT,
  origin_contribution_id UUID,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS cities (
  id           TEXT NOT NULL,
  planet_id    TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civ_id       TEXT NOT NULL,
  name         TEXT NOT NULL,
  cell         INT NOT NULL,
  population   BIGINT NOT NULL,
  founded_at_tick BIGINT NOT NULL,
  destroyed_at_tick BIGINT,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS technologies (
  id        TEXT NOT NULL,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  tier      INT NOT NULL,
  effects   JSONB NOT NULL,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS cultures (
  id        TEXT NOT NULL,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  values    JSONB NOT NULL,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS languages (
  id        TEXT NOT NULL,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  family    TEXT NOT NULL,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS trade_routes (
  id            TEXT NOT NULL,
  planet_id     TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_city_id  TEXT NOT NULL,
  to_city_id    TEXT NOT NULL,
  path          JSONB NOT NULL,
  volume        DOUBLE PRECISION NOT NULL,
  created_at_tick BIGINT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS alliances (
  id              TEXT NOT NULL,
  planet_id       TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  member_civ_ids  JSONB NOT NULL,
  reason          TEXT NOT NULL,
  created_at_tick BIGINT NOT NULL,
  dissolved_at_tick BIGINT,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS wars (
  id              TEXT NOT NULL,
  planet_id       TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  attacker_civ_id TEXT NOT NULL,
  defender_civ_id TEXT NOT NULL,
  cause           TEXT NOT NULL,
  battles         INT NOT NULL DEFAULT 0,
  casualties      BIGINT NOT NULL DEFAULT 0,
  started_at_tick BIGINT NOT NULL,
  ended_at_tick   BIGINT,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS diseases (
  id               TEXT NOT NULL,
  planet_id        TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  severity         DOUBLE PRECISION NOT NULL,
  contagiousness   DOUBLE PRECISION NOT NULL,
  origin_cell      INT NOT NULL,
  affected_civ_ids JSONB NOT NULL,
  started_at_tick  BIGINT NOT NULL,
  ended_at_tick    BIGINT,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS migrations (
  id              TEXT NOT NULL,
  planet_id       TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  civ_id          TEXT,
  species_id      TEXT,
  from_cell       INT NOT NULL,
  to_cell         INT NOT NULL,
  path            JSONB NOT NULL,
  people          BIGINT NOT NULL,
  reason          TEXT NOT NULL,
  started_at_tick BIGINT NOT NULL,
  PRIMARY KEY (planet_id, id)
);

-- ---------------------------------------------------------------------------
-- contributions, events, causality, snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_contributions (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planet_id     TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  raw_text      TEXT NOT NULL,
  structured    JSONB NOT NULL,
  balance       JSONB NOT NULL,
  origin_cell   INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'analyzed',
  impact_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at_tick BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contributions_user_idx ON user_contributions (user_id);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick      BIGINT NOT NULL,
  year      BIGINT NOT NULL,
  event_count INT NOT NULL DEFAULT 0,
  duration_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, tick)
);

CREATE TABLE IF NOT EXISTS world_events (
  id           TEXT NOT NULL,
  planet_id    TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick         BIGINT NOT NULL,
  year         BIGINT NOT NULL,
  type         TEXT NOT NULL,
  cell         INT NOT NULL,
  cause_ids    JSONB NOT NULL,
  cause        TEXT NOT NULL,
  actors       JSONB NOT NULL,
  data         JSONB NOT NULL,
  confidence   DOUBLE PRECISION NOT NULL,
  importance   DOUBLE PRECISION NOT NULL,
  origin_user_id UUID,
  origin_contribution_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (planet_id, id)
);
CREATE INDEX IF NOT EXISTS world_events_tick_idx ON world_events (planet_id, tick);
CREATE INDEX IF NOT EXISTS world_events_type_idx ON world_events (planet_id, type);
CREATE INDEX IF NOT EXISTS world_events_origin_idx ON world_events (origin_user_id);

CREATE TABLE IF NOT EXISTS causal_links (
  id        TEXT NOT NULL,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  from_id   TEXT NOT NULL,
  to_id     TEXT NOT NULL,
  weight    DOUBLE PRECISION NOT NULL,
  mechanism TEXT NOT NULL,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id          TEXT NOT NULL,
  planet_id   TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick        BIGINT NOT NULL,
  year        BIGINT NOT NULL,
  state       JSONB NOT NULL,
  event_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (planet_id, id)
);
CREATE INDEX IF NOT EXISTS snapshots_tick_idx ON timeline_snapshots (planet_id, tick);

-- ---------------------------------------------------------------------------
-- ai, moderation, notifications, audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_requests (
  id         UUID PRIMARY KEY,
  provider   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  tokens_in  INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  cost_usd   DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  success    BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_results (
  id         UUID PRIMARY KEY,
  target_id  TEXT NOT NULL,
  verdict    TEXT NOT NULL,
  reasons    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  event_id   TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY,
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,
  detail     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

INSERT INTO roles (name) VALUES
  ('visitor'), ('user'), ('explorer'), ('life_maker'),
  ('civilization_builder'), ('historian'), ('moderator'),
  ('simulation_admin'), ('admin'), ('super_admin')
ON CONFLICT (name) DO NOTHING;

INSERT INTO biomes (name) VALUES
  ('ocean'), ('coast'), ('plains'), ('rainforest'), ('temperate_forest'),
  ('desert'), ('mountains'), ('tundra'), ('swamp'), ('steppe'),
  ('volcanic'), ('ice')
ON CONFLICT (name) DO NOTHING;
