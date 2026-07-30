-- Event sourcing: simulation ticks, world events, causal links, snapshots
CREATE TABLE simulation_ticks (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  tick INT NOT NULL,
  years_per_tick INT NOT NULL,
  duration_ms INT NOT NULL,
  event_count INT NOT NULL,
  state_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (planet_id, tick)
);

CREATE TABLE world_events (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  tick INT NOT NULL,
  type TEXT NOT NULL,
  importance INT NOT NULL,
  cell_id INT,
  civ_ids JSONB NOT NULL DEFAULT '[]',
  species_ids JSONB NOT NULL DEFAULT '[]',
  plant_ids JSONB NOT NULL DEFAULT '[]',
  cause_event_id TEXT,
  contribution_id UUID,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (planet_id, id)
);
CREATE INDEX world_events_tick_idx ON world_events (planet_id, tick DESC);
CREATE INDEX world_events_type_idx ON world_events (planet_id, type);
CREATE INDEX world_events_contribution_idx ON world_events (planet_id, contribution_id);
CREATE INDEX world_events_importance_idx ON world_events (planet_id, importance DESC, tick DESC);

-- explicit causal edges for fast graph traversal
CREATE TABLE causal_links (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  cause_event_id TEXT,
  contribution_id UUID,
  PRIMARY KEY (planet_id, event_id)
);
CREATE INDEX causal_links_cause_idx ON causal_links (planet_id, cause_event_id);
CREATE INDEX causal_links_contribution_idx ON causal_links (planet_id, contribution_id);

CREATE TABLE timeline_snapshots (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tick INT NOT NULL,
  state JSONB NOT NULL,
  state_hash TEXT NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (planet_id, tick)
);

-- semantic memory for world history (pgvector)
CREATE TABLE world_memory (
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,           -- war | discovery | disaster | relation | contribution
  text TEXT NOT NULL,
  embedding VECTOR(1536),
  civ_ids JSONB NOT NULL DEFAULT '[]',
  tick INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (planet_id, id)
);
CREATE INDEX world_memory_embedding_idx ON world_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
