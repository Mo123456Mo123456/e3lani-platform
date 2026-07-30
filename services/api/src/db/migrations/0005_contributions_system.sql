-- Contributions, AI accounting, moderation, notifications, ops
CREATE TABLE user_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planet_id UUID NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  structured JSONB,
  balance JSONB,
  graph JSONB,
  assessment JSONB,
  preview_report JSONB,
  target_cell_id INT,
  applied_tick INT,
  provider TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT true,
  narrative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_contributions_user_idx ON user_contributions (user_id, created_at DESC);
CREATE INDEX user_contributions_planet_idx ON user_contributions (planet_id, status);

CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  contribution_id UUID,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,           -- parse | balance | narrate | moderate
  sandbox BOOLEAN NOT NULL DEFAULT true,
  tokens_in INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok', -- ok | error | fallback
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_created_idx ON ai_requests (created_at DESC);

CREATE TABLE moderation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'contribution',
  text TEXT NOT NULL,
  status TEXT NOT NULL,         -- allow | flag | block
  reasons JSONB NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'none', -- none | pending | approved | rejected
  reviewer_id UUID,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, read, created_at DESC);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,           -- contribution_preview | snapshot | maps
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX jobs_status_idx ON jobs (status, run_after);

CREATE TABLE analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_name_idx ON analytics_events (name, at DESC);
