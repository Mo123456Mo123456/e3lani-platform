/**
 * Database table types for Kysely. Mirrors src/db/migrations/*.sql.
 * Only typed fields are used by the API; JSONB columns use `unknown`
 * shapes cast at the boundary.
 */
import type { ColumnType } from "kysely";

export type Generated<T> = ColumnType<T, T | undefined, T>;
export type Json<T> = ColumnType<T, T | string, T | string>;
/** Columns with DB defaults: optional on insert, concrete on select/update. */
export type Defaulted<T> = ColumnType<T, T | undefined, T>;
export type Timestamptz = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  email: string | null;
  password_hash: string | null;
  display_name: string;
  role: Defaulted<string>;
  locale: Defaulted<string>;
  avatar_url: string | null;
  oauth_provider: string | null;
  oauth_subject: string | null;
  suspended: Defaulted<boolean>;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface ProfilesTable {
  user_id: string;
  bio: Defaulted<string>;
  impact_score: Defaulted<number>;
  achievements: Defaulted<Json<unknown[]>>;
  title: Defaulted<string>;
  updated_at: Timestamptz;
}

export interface RolesTable {
  user_id: string;
  role: string;
  granted_by: string | null;
  granted_at: Timestamptz;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: Timestamptz;
  revoked_at: Timestamptz | null;
  replaced_by: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: Timestamptz;
}

export interface PlanetsTable {
  id: Generated<string>;
  name: string;
  seed: number;
  status: Defaulted<string>;
  tick: Defaulted<number>;
  years_per_tick: Defaulted<number>;
  grid: Json<{ latBands: number; lonBands: number }>;
  current_state: Json<Record<string, unknown>>;
  state_hash: string | null;
  map_tick: Defaulted<number>;
  created_by: string | null;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface PlanetRegionsTable {
  planet_id: string;
  cell_id: number;
  geom: unknown;
  lat: number;
  lon: number;
  biome: string;
  height: number;
  fertility: number;
  pollution: number;
  vegetation: number;
  freshwater: boolean;
  owner_civ_id: string | null;
  city_id: string | null;
  deposits: Json<Record<string, number>>;
  present_plants: number;
  present_species: number;
  updated_tick: number;
}

export interface ClimateCellsTable {
  planet_id: string;
  cell_id: number;
  tick: number;
  temp: number;
  moisture: number;
  drought_streak: number;
}

export interface BiomesTable {
  name: string;
  palette: Json<number[]>;
  vegetation_capacity: number;
}

export interface SpeciesTable {
  planet_id: string;
  id: string;
  name: string;
  traits: Json<Record<string, unknown>>;
  diet: string;
  total_population: number;
  cell_count: number;
  extinct: boolean;
  parent_id: string | null;
  contribution_id: string | null;
  updated_tick: number;
}

export interface PlantsTable {
  planet_id: string;
  id: string;
  name: string;
  home_biome: string;
  traits: Json<Record<string, unknown>>;
  cell_count: number;
  extinct: boolean;
  contribution_id: string | null;
  updated_tick: number;
}

export interface ResourcesTable {
  planet_id: string;
  id: string;
  name: string;
  kind: string;
  base_value: number;
  regen: number;
  env_impact: number;
  contribution_id: string | null;
}

export interface CivilizationsTable {
  planet_id: string;
  id: string;
  name: string;
  culture: string;
  language: string;
  government: string;
  population: number;
  tech_level: number;
  military: number;
  treasury: number;
  happiness: number;
  health: number;
  stability: number;
  education: number;
  personality: Json<Record<string, number>>;
  relationships: Json<Record<string, unknown>>;
  memory: Json<string[]>;
  extinct: boolean;
  contribution_id: string | null;
  updated_tick: number;
}

export interface CitiesTable {
  planet_id: string;
  id: string;
  civ_id: string;
  cell_id: number;
  name: string;
  population: number;
  founded_tick: number;
  updated_tick: number;
}

export interface TechnologiesTable {
  planet_id: string;
  id: string;
  name: string;
  tier: number;
  discovered_by: string | null;
  discovered_tick: number | null;
  contribution_id: string | null;
}

export interface CulturesTable {
  planet_id: string;
  name: string;
  civ_id: string;
  influence: number;
  born_tick: number;
}

export interface LanguagesTable {
  planet_id: string;
  name: string;
  civ_id: string;
  born_tick: number;
}

export interface TradeRoutesTable {
  planet_id: string;
  id: string;
  civ_a: string;
  civ_b: string;
  city_a: string;
  city_b: string;
  commodity: string;
  path: Json<number[]>;
  volume: number;
  active: boolean;
  created_tick: number;
}

export interface AlliancesTable {
  planet_id: string;
  id: string;
  members: Json<string[]>;
  formed_tick: number;
  active: boolean;
}

export interface WarsTable {
  planet_id: string;
  id: string;
  attacker: string;
  defender: string;
  start_tick: number;
  end_tick: number | null;
  fronts: Json<number[]>;
  causes: Json<Array<{ factor: string; weight: number }>>;
  active: boolean;
}

export interface DiseasesTable {
  planet_id: string;
  id: string;
  origin_cell: number | null;
  severity: number;
  transmission: number;
  civs: Json<string[]>;
  start_tick: number;
  active: boolean;
  contribution_id: string | null;
}

export interface MigrationsTable {
  planet_id: string;
  id: string;
  civ_id: string | null;
  species_id: string | null;
  from_cell: number;
  to_cell: number;
  size: number;
  tick: number;
}

export interface PlanetMapLayersTable {
  planet_id: string;
  layer: string;
  tick: number;
  png: Buffer;
}

export interface SimulationTicksTable {
  planet_id: string;
  tick: number;
  years_per_tick: number;
  duration_ms: number;
  event_count: number;
  state_hash: string;
  created_at: Timestamptz;
}

export interface WorldEventsTable {
  planet_id: string;
  id: string;
  tick: number;
  type: string;
  importance: number;
  cell_id: number | null;
  civ_ids: Json<string[]>;
  species_ids: Json<string[]>;
  plant_ids: Json<string[]>;
  cause_event_id: string | null;
  contribution_id: string | null;
  confidence: number;
  payload: Json<Record<string, unknown>>;
  created_at: Timestamptz;
}

export interface CausalLinksTable {
  planet_id: string;
  event_id: string;
  cause_event_id: string | null;
  contribution_id: string | null;
}

export interface TimelineSnapshotsTable {
  planet_id: string;
  id: Generated<string>;
  tick: number;
  state: Json<Record<string, unknown>>;
  state_hash: string;
  summary: Json<Record<string, number>>;
  created_at: Timestamptz;
}

export interface WorldMemoryTable {
  planet_id: string;
  id: Generated<string>;
  kind: string;
  text: string;
  embedding: number[] | string | null;
  civ_ids: Json<string[]>;
  tick: number;
  created_at: Timestamptz;
}

export interface UserContributionsTable {
  id: Generated<string>;
  user_id: string;
  planet_id: string;
  category: string;
  raw_text: string;
  name: string | null;
  status: Defaulted<string>;
  structured: Json<Record<string, unknown> | null>;
  balance: Json<Record<string, unknown> | null>;
  graph: Json<Record<string, unknown> | null>;
  assessment: Json<Record<string, unknown> | null>;
  preview_report: Json<Record<string, unknown> | null>;
  target_cell_id: number | null;
  applied_tick: number | null;
  provider: string | null;
  sandbox: Defaulted<boolean>;
  narrative: string | null;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface AiRequestsTable {
  id: Generated<string>;
  user_id: string | null;
  contribution_id: string | null;
  provider: string;
  kind: string;
  sandbox: boolean;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  status: string;
  detail: Json<Record<string, unknown>>;
  created_at: Timestamptz;
}

export interface ModerationResultsTable {
  id: Generated<string>;
  user_id: string | null;
  kind: string;
  text: string;
  status: string;
  reasons: Json<string[]>;
  review_status: string;
  reviewer_id: string | null;
  review_note: string | null;
  created_at: Timestamptz;
  reviewed_at: Timestamptz | null;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data: Json<Record<string, unknown>>;
  read: Defaulted<boolean>;
  created_at: Timestamptz;
}

export interface AuditLogsTable {
  id: Generated<string>;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Json<Record<string, unknown>>;
  ip: string | null;
  created_at: Timestamptz;
}

export interface JobsTable {
  id: Generated<string>;
  kind: string;
  status: Defaulted<string>;
  payload: Json<Record<string, unknown>>;
  result: Json<Record<string, unknown> | null>;
  error: string | null;
  attempts: Defaulted<number>;
  run_after: Timestamptz;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface AnalyticsEventsTable {
  id: Generated<number>;
  user_id: string | null;
  name: string;
  props: Json<Record<string, unknown>>;
  at: Timestamptz;
}

export interface Database {
  users: UsersTable;
  profiles: ProfilesTable;
  roles: RolesTable;
  refresh_tokens: RefreshTokensTable;
  planets: PlanetsTable;
  planet_regions: PlanetRegionsTable;
  climate_cells: ClimateCellsTable;
  biomes: BiomesTable;
  species: SpeciesTable;
  plants: PlantsTable;
  resources: ResourcesTable;
  civilizations: CivilizationsTable;
  cities: CitiesTable;
  technologies: TechnologiesTable;
  cultures: CulturesTable;
  languages: LanguagesTable;
  trade_routes: TradeRoutesTable;
  alliances: AlliancesTable;
  wars: WarsTable;
  diseases: DiseasesTable;
  migrations: MigrationsTable;
  planet_map_layers: PlanetMapLayersTable;
  simulation_ticks: SimulationTicksTable;
  world_events: WorldEventsTable;
  causal_links: CausalLinksTable;
  timeline_snapshots: TimelineSnapshotsTable;
  world_memory: WorldMemoryTable;
  user_contributions: UserContributionsTable;
  ai_requests: AiRequestsTable;
  moderation_results: ModerationResultsTable;
  notifications: NotificationsTable;
  audit_logs: AuditLogsTable;
  jobs: JobsTable;
  analytics_events: AnalyticsEventsTable;
}
