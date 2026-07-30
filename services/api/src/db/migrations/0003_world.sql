-- World: planets, materialized read models, snapshots
CREATE TABLE planets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  seed BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused',        -- running | paused
  tick INT NOT NULL DEFAULT 0,
  years_per_tick INT NOT NULL DEFAULT 1,
  grid JSONB NOT NULL,                           -- {latBands, lonBands}
  current_state JSONB NOT NULL,                  -- full engine state (authoritative)
  state_hash TEXT,
  map_tick INT NOT NULL DEFAULT -1,              -- last tick maps were rendered
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE planet_regions (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  cell_id INT NOT NULL,
  geom GEOGRAPHY(Point, 4326),
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  biome TEXT NOT NULL,
  height DOUBLE PRECISION NOT NULL,
  fertility DOUBLE PRECISION NOT NULL,
  pollution DOUBLE PRECISION NOT NULL,
  vegetation DOUBLE PRECISION NOT NULL,
  freshwater BOOLEAN NOT NULL,
  owner_civ_id TEXT,
  city_id TEXT,
  deposits JSONB NOT NULL DEFAULT '{}',
  present_plants INT NOT NULL DEFAULT 0,
  present_species INT NOT NULL DEFAULT 0,
  updated_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, cell_id)
);

-- climate cells materialized per snapshot (history of climate state)
CREATE TABLE climate_cells (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  cell_id INT NOT NULL,
  tick INT NOT NULL,
  temp DOUBLE PRECISION NOT NULL,
  moisture DOUBLE PRECISION NOT NULL,
  drought_streak INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, cell_id, tick)
);

CREATE TABLE biomes (
  name TEXT PRIMARY KEY,
  palette JSONB NOT NULL,
  vegetation_capacity DOUBLE PRECISION NOT NULL
);

CREATE TABLE species (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  traits JSONB NOT NULL,
  diet TEXT NOT NULL,
  total_population DOUBLE PRECISION NOT NULL,
  cell_count INT NOT NULL,
  extinct BOOLEAN NOT NULL DEFAULT false,
  parent_id TEXT,
  contribution_id UUID,
  updated_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE plants (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  home_biome TEXT NOT NULL,
  traits JSONB NOT NULL,
  cell_count INT NOT NULL,
  extinct BOOLEAN NOT NULL DEFAULT false,
  contribution_id UUID,
  updated_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE resources (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_value DOUBLE PRECISION NOT NULL,
  regen DOUBLE PRECISION NOT NULL,
  env_impact DOUBLE PRECISION NOT NULL,
  contribution_id UUID,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE civilizations (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  culture TEXT NOT NULL,
  language TEXT NOT NULL,
  government TEXT NOT NULL,
  population DOUBLE PRECISION NOT NULL,
  tech_level INT NOT NULL,
  military DOUBLE PRECISION NOT NULL,
  treasury DOUBLE PRECISION NOT NULL,
  happiness DOUBLE PRECISION NOT NULL,
  health DOUBLE PRECISION NOT NULL,
  stability DOUBLE PRECISION NOT NULL,
  education DOUBLE PRECISION NOT NULL,
  personality JSONB NOT NULL,
  relationships JSONB NOT NULL,
  memory JSONB NOT NULL,
  extinct BOOLEAN NOT NULL DEFAULT false,
  contribution_id UUID,
  updated_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE cities (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  civ_id TEXT NOT NULL,
  cell_id INT NOT NULL,
  name TEXT NOT NULL,
  population INT NOT NULL,
  founded_tick INT NOT NULL,
  updated_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE technologies (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  tier INT NOT NULL,
  discovered_by TEXT,
  discovered_tick INT,
  contribution_id UUID,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE cultures (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  civ_id TEXT NOT NULL,
  influence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  born_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, name)
);

CREATE TABLE languages (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  civ_id TEXT NOT NULL,
  born_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (planet_id, name)
);

CREATE TABLE trade_routes (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  civ_a TEXT NOT NULL,
  civ_b TEXT NOT NULL,
  city_a TEXT NOT NULL,
  city_b TEXT NOT NULL,
  commodity TEXT NOT NULL,
  path JSONB NOT NULL,
  volume DOUBLE PRECISION NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_tick INT NOT NULL,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE alliances (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  members JSONB NOT NULL,
  formed_tick INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE wars (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  attacker TEXT NOT NULL,
  defender TEXT NOT NULL,
  start_tick INT NOT NULL,
  end_tick INT,
  fronts JSONB NOT NULL,
  causes JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE diseases (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  origin_cell INT,
  severity DOUBLE PRECISION NOT NULL,
  transmission DOUBLE PRECISION NOT NULL,
  civs JSONB NOT NULL,
  start_tick INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  contribution_id UUID,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE migrations (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  civ_id TEXT,
  species_id TEXT,
  from_cell INT NOT NULL,
  to_cell INT NOT NULL,
  size DOUBLE PRECISION NOT NULL,
  tick INT NOT NULL,
  PRIMARY KEY (planet_id, id)
);

CREATE TABLE planet_map_layers (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  layer TEXT NOT NULL,
  tick INT NOT NULL,
  png BYTEA NOT NULL,
  PRIMARY KEY (planet_id, layer, tick)
);
