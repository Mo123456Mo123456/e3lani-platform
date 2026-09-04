-- VERO 0001 — المخطط الأساسي
-- كل زيارة لها إثبات.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────── الشركة ───────────────────────────
CREATE TABLE companies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  logo_path             text,
  city                  text,
  phone                 text,
  email                 text,
  address               text,
  default_gps_radius_m  integer     NOT NULL DEFAULT 30 CHECK (default_gps_radius_m BETWEEN 5 AND 5000),
  timezone              text        NOT NULL DEFAULT 'Asia/Riyadh',
  setup_completed_at    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- نسخة واحدة = شركة واحدة (Single-Tenant مفروض على مستوى قاعدة البيانات)
CREATE UNIQUE INDEX companies_singleton ON companies ((true));

-- ─────────────────────────── المستخدمون ───────────────────────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  username      text NOT NULL,
  email         text,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  role          text NOT NULL CHECK (role IN ('ADMIN','SUPERVISOR','VIEWER')),
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_unique ON users (lower(username));

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX refresh_tokens_hash_unique ON refresh_tokens (token_hash);

-- ─────────────────────────── السيارات والعمال ───────────────────────────
CREATE TABLE vehicles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  internal_no       text NOT NULL,
  name              text,
  plate_no          text,
  vehicle_type      text,
  status            text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','MAINTENANCE')),
  current_worker_id uuid,
  last_seen_at      timestamptz,
  last_location     geography(Point,4326),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vehicles_internal_no_unique ON vehicles (company_id, lower(internal_no));

CREATE TABLE workers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name          text NOT NULL,
  employee_no        text NOT NULL,
  phone              text,
  status             text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  default_vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workers_employee_no_unique ON workers (company_id, lower(employee_no));

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_current_worker_fk
  FOREIGN KEY (current_worker_id) REFERENCES workers(id) ON DELETE SET NULL;

-- ─────────────────────────── الحاويات ───────────────────────────
CREATE TABLE bins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  public_id     text NOT NULL,
  name          text,
  sector        text,
  area          text,
  address       text,
  location      geography(Point,4326) NOT NULL,
  gps_radius_m  integer NOT NULL CHECK (gps_radius_m BETWEEN 5 AND 5000),
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  qr_printed_at timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bins_public_id_unique ON bins (company_id, upper(public_id));
CREATE INDEX bins_location_gix ON bins USING GIST (location);
CREATE INDEX bins_sector_idx ON bins (company_id, sector);
CREATE INDEX bins_status_idx ON bins (company_id, status);

-- تسلسل ترقيم الحاويات VR-000001
CREATE SEQUENCE bin_public_seq START 1;

-- ─────────────────────────── رموز QR ───────────────────────────
CREATE TABLE qr_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bin_id        uuid NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  nonce         text NOT NULL,
  token_version integer NOT NULL DEFAULT 1,
  is_active     boolean NOT NULL DEFAULT true,
  print_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);
CREATE UNIQUE INDEX qr_tokens_active_bin ON qr_tokens (bin_id) WHERE is_active;
CREATE UNIQUE INDEX qr_tokens_nonce_unique ON qr_tokens (nonce);

-- ─────────────────────────── الأجهزة ───────────────────────────
CREATE TABLE devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_uid   text NOT NULL,
  platform     text,
  model        text,
  app_version  text,
  token_hash   text NOT NULL,
  status       text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX devices_token_hash_unique ON devices (token_hash);
CREATE INDEX devices_uid_idx ON devices (company_id, device_uid);

CREATE TABLE device_bindings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id  uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  worker_id  uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  bound_at   timestamptz NOT NULL DEFAULT now(),
  unbound_at timestamptz
);
CREATE UNIQUE INDEX device_bindings_active ON device_bindings (device_id) WHERE unbound_at IS NULL;

CREATE TABLE activation_codes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code              text NOT NULL,
  worker_id         uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  vehicle_id        uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at        timestamptz NOT NULL,
  consumed_at       timestamptz,
  consumed_device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX activation_codes_code_unique ON activation_codes (code);

-- ─────────────────────────── جلسات ونقاط المسار ───────────────────────────
CREATE TABLE route_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worker_id    uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  vehicle_id   uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id    uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  service_day  date NOT NULL,
  points_count integer NOT NULL DEFAULT 0,
  distance_m   double precision NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_sessions_day_idx ON route_sessions (company_id, service_day);
CREATE INDEX route_sessions_vehicle_idx ON route_sessions (vehicle_id, started_at DESC);

CREATE TABLE route_points (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES route_sessions(id) ON DELETE CASCADE,
  client_uuid uuid NOT NULL,
  recorded_at timestamptz NOT NULL,
  location    geography(Point,4326) NOT NULL,
  speed_mps   real,
  accuracy_m  real,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX route_points_client_uuid_unique ON route_points (client_uuid);
CREATE INDEX route_points_session_idx ON route_points (session_id, recorded_at);
CREATE INDEX route_points_gix ON route_points USING GIST (location);

-- ─────────────────────────── الزيارات (Scans) ───────────────────────────
CREATE TABLE scans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_uuid    uuid NOT NULL,
  bin_id         uuid NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  qr_nonce       text NOT NULL,
  worker_id      uuid REFERENCES workers(id) ON DELETE SET NULL,
  vehicle_id     uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  device_id      uuid REFERENCES devices(id) ON DELETE SET NULL,
  session_id     uuid REFERENCES route_sessions(id) ON DELETE SET NULL,
  scanned_at     timestamptz NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  service_day    date NOT NULL,
  location       geography(Point,4326) NOT NULL,
  gps_accuracy_m real,
  distance_m     double precision NOT NULL,
  radius_m       integer NOT NULL,
  status         text NOT NULL CHECK (status IN ('VERIFIED','SUSPICIOUS','INVALID')),
  counted        boolean NOT NULL DEFAULT false,
  duplicate_of   uuid REFERENCES scans(id) ON DELETE SET NULL,
  offline        boolean NOT NULL DEFAULT false,
  reasons        text[] NOT NULL DEFAULT '{}',
  prev_hash      text,
  proof_hash     text NOT NULL,
  chain_seq      bigint NOT NULL,
  review_status  text NOT NULL DEFAULT 'NONE' CHECK (review_status IN ('NONE','PENDING','ACCEPTED','REJECTED')),
  reviewed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  review_note    text
);
CREATE UNIQUE INDEX scans_client_uuid_unique ON scans (client_uuid);
CREATE UNIQUE INDEX scans_daily_counted_unique ON scans (bin_id, service_day) WHERE counted;
CREATE UNIQUE INDEX scans_chain_seq_unique ON scans (company_id, chain_seq);
CREATE INDEX scans_day_status_idx ON scans (company_id, service_day, status);
CREATE INDEX scans_bin_day_idx ON scans (bin_id, service_day);
CREATE INDEX scans_worker_day_idx ON scans (worker_id, service_day);
CREATE INDEX scans_vehicle_day_idx ON scans (vehicle_id, service_day);
CREATE INDEX scans_review_idx ON scans (company_id, review_status) WHERE review_status <> 'NONE';

CREATE SEQUENCE scan_chain_seq START 1;

-- كل محاولة مسح، حتى غير الصالحة (سجل التدقيق الميداني)
CREATE TABLE scan_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bin_id      uuid REFERENCES bins(id) ON DELETE SET NULL,
  scan_id     uuid REFERENCES scans(id) ON DELETE SET NULL,
  raw_token   text,
  device_id   uuid REFERENCES devices(id) ON DELETE SET NULL,
  worker_id   uuid REFERENCES workers(id) ON DELETE SET NULL,
  vehicle_id  uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  result      text NOT NULL,
  reason      text,
  location    geography(Point,4326),
  client_uuid uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_attempts_created_idx ON scan_attempts (company_id, created_at DESC);
CREATE INDEX scan_attempts_bin_idx ON scan_attempts (bin_id, created_at DESC);

-- ─────────────────────────── عقود SLA والتقارير ───────────────────────────
CREATE TABLE sla_contracts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  client_name             text,
  required_visits_per_day integer NOT NULL DEFAULT 1 CHECK (required_visits_per_day >= 1),
  scope_sector            text,
  expected_points         integer,
  active_from             date NOT NULL,
  active_to               date,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_no    text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('DAILY','WEEKLY','MONTHLY','CUSTOM')),
  period_start date NOT NULL,
  period_end   date NOT NULL,
  sla_contract_id uuid REFERENCES sla_contracts(id) ON DELETE SET NULL,
  verify_token text NOT NULL,
  payload      jsonb NOT NULL,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reports_no_unique ON reports (company_id, report_no);
CREATE UNIQUE INDEX reports_verify_token_unique ON reports (verify_token);
CREATE SEQUENCE report_no_seq START 1;

CREATE TABLE report_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  dimension  text NOT NULL,
  key        text NOT NULL,
  label      text,
  required   integer NOT NULL DEFAULT 0,
  verified   integer NOT NULL DEFAULT 0,
  suspicious integer NOT NULL DEFAULT 0,
  invalid    integer NOT NULL DEFAULT 0,
  missed     integer NOT NULL DEFAULT 0,
  ratio      numeric(6,2) NOT NULL DEFAULT 0
);
CREATE INDEX report_items_report_idx ON report_items (report_id, dimension);

-- ─────────────────────────── سجل التدقيق والإعدادات والنسخ ───────────────────────────
CREATE TABLE audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  actor_label    text,
  action         text NOT NULL,
  entity         text NOT NULL,
  entity_id      text,
  before         jsonb,
  after          jsonb,
  ip             text,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (company_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (company_id, entity, entity_id);

CREATE TABLE settings (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, key)
);

CREATE TABLE backups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  size_bytes  bigint NOT NULL DEFAULT 0,
  kind        text NOT NULL DEFAULT 'MANUAL' CHECK (kind IN ('MANUAL','AUTO')),
  status      text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','READY','FAILED')),
  error       text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX backups_created_idx ON backups (company_id, created_at DESC);
