CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('draft', 'analyzed', 'queued', 'simulating', 'committed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tick_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"contribution_id" uuid,
	"provider" varchar(40) NOT NULL,
	"model" varchar(120) NOT NULL,
	"purpose" varchar(64) NOT NULL,
	"prompt_hash" varchar(64) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"success" boolean NOT NULL,
	"error_code" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"member_civilization_ids" jsonb NOT NULL,
	"terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"founded_at_tick" bigint NOT NULL,
	"dissolved_at_tick" bigint
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(80) NOT NULL,
	"resource_id" varchar(160),
	"before" jsonb,
	"after" jsonb,
	"ip_hash" varchar(64),
	"user_agent" varchar(500),
	"trace_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biomes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "causal_links" (
	"source_event_id" uuid NOT NULL,
	"target_event_id" uuid NOT NULL,
	"relation" varchar(24) NOT NULL,
	"strength" real NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "causal_links_source_event_id_target_event_id_pk" PRIMARY KEY("source_event_id","target_event_id")
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"population" bigint DEFAULT 0 NOT NULL,
	"health" real DEFAULT 1 NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"civilization_id" uuid,
	"food_stock" double precision DEFAULT 0 NOT NULL,
	"infrastructure" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civilizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"population" bigint DEFAULT 0 NOT NULL,
	"health" real DEFAULT 1 NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"government" varchar(80),
	"technology_level" real DEFAULT 0 NOT NULL,
	"military_power" real DEFAULT 0 NOT NULL,
	"economic_power" real DEFAULT 0 NOT NULL,
	"stability" real DEFAULT 0.5 NOT NULL,
	"historical_memory" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "climate_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"temperature" real NOT NULL,
	"humidity" real NOT NULL,
	"pressure" real NOT NULL,
	"wind_u" real NOT NULL,
	"wind_v" real NOT NULL,
	"precipitation" real NOT NULL,
	"tick" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"civilization_id" uuid,
	"language_id" uuid,
	"name" varchar(120) NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"influence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diseases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"origin_region_id" uuid,
	"transmissibility" real NOT NULL,
	"mortality" real NOT NULL,
	"affected_entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"parent_language_id" uuid,
	"speaker_count" bigint DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migrations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"origin_region_id" uuid NOT NULL,
	"destination_region_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"population" bigint NOT NULL,
	"path" jsonb NOT NULL,
	"cause" text NOT NULL,
	"started_at_tick" bigint NOT NULL,
	"ended_at_tick" bigint
);
--> statement-breakpoint
CREATE TABLE "moderation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"accepted" boolean NOT NULL,
	"rule_matches" jsonb NOT NULL,
	"classifier_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prompt_injection_score" real DEFAULT 0 NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(180) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planet_regions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"biome_id" varchar(40) NOT NULL,
	"region_index" integer NOT NULL,
	"name_ar" varchar(120) NOT NULL,
	"name_en" varchar(120) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"elevation" real NOT NULL,
	"temperature" real NOT NULL,
	"moisture" real NOT NULL,
	"fertility" real NOT NULL,
	"pollution" real DEFAULT 0 NOT NULL,
	"population" bigint DEFAULT 0 NOT NULL,
	"resource_richness" real NOT NULL,
	"cell" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_ar" varchar(120) NOT NULL,
	"name_en" varchar(120) NOT NULL,
	"seed" varchar(200) NOT NULL,
	"algorithm_version" varchar(32) DEFAULT 'worldgen-1' NOT NULL,
	"current_tick" bigint DEFAULT 0 NOT NULL,
	"current_year" integer NOT NULL,
	"tick_duration" varchar(16) DEFAULT 'year' NOT NULL,
	"running" boolean DEFAULT false NOT NULL,
	"state_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planets_seed_unique" UNIQUE("seed")
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"population" bigint DEFAULT 0 NOT NULL,
	"health" real DEFAULT 1 NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"growth_rate" real DEFAULT 0.5 NOT NULL,
	"water_need" real DEFAULT 0.5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"avatar_url" text,
	"impact_score" integer DEFAULT 0 NOT NULL,
	"bio" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"population" bigint DEFAULT 0 NOT NULL,
	"health" real DEFAULT 1 NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"regeneration_rate" real DEFAULT 0 NOT NULL,
	"extraction_rate" real DEFAULT 0 NOT NULL,
	"unit_value" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "simulation_ticks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"tick" bigint NOT NULL,
	"year" integer NOT NULL,
	"status" "tick_status" DEFAULT 'queued' NOT NULL,
	"seed_state" varchar(128) NOT NULL,
	"state_hash" varchar(64),
	"duration_ms" integer,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"population" bigint DEFAULT 0 NOT NULL,
	"health" real DEFAULT 1 NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"diet" varchar(40),
	"mutation_rate" real DEFAULT 0.01 NOT NULL,
	"extinction_risk" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"civilization_id" uuid,
	"name" varchar(160) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discovered_at_tick" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"tick" bigint NOT NULL,
	"sequence" bigint NOT NULL,
	"state_hash" varchar(64) NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"origin_city_id" uuid NOT NULL,
	"destination_city_id" uuid NOT NULL,
	"path" jsonb NOT NULL,
	"distance" real NOT NULL,
	"risk" real NOT NULL,
	"volume" double precision NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_contributions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"category" varchar(40) NOT NULL,
	"name" varchar(160) NOT NULL,
	"original_idea" text NOT NULL,
	"structured_analysis" jsonb NOT NULL,
	"status" "contribution_status" DEFAULT 'draft' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"locale" varchar(5) DEFAULT 'ar' NOT NULL,
	"refresh_token_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wars" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"attacker_ids" jsonb NOT NULL,
	"defender_ids" jsonb NOT NULL,
	"causes" jsonb NOT NULL,
	"started_at_tick" bigint NOT NULL,
	"ended_at_tick" bigint,
	"outcome" jsonb,
	"casualties" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"type" varchar(64) NOT NULL,
	"tick" bigint NOT NULL,
	"year" integer NOT NULL,
	"region_id" uuid,
	"contribution_id" uuid,
	"cause" text NOT NULL,
	"cause_event_ids" jsonb NOT NULL,
	"actor_ids" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"confidence" real NOT NULL,
	"direct_impact" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"entity_id" uuid,
	"memory_type" varchar(64) NOT NULL,
	"content" text NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(1536),
	"valid_from_tick" bigint NOT NULL,
	"valid_to_tick" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_contribution_id_user_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."user_contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliances" ADD CONSTRAINT "alliances_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "causal_links" ADD CONSTRAINT "causal_links_source_event_id_world_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."world_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "causal_links" ADD CONSTRAINT "causal_links_target_event_id_world_events_id_fk" FOREIGN KEY ("target_event_id") REFERENCES "public"."world_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civilizations" ADD CONSTRAINT "civilizations_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civilizations" ADD CONSTRAINT "civilizations_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climate_cells" ADD CONSTRAINT "climate_cells_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climate_cells" ADD CONSTRAINT "climate_cells_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_origin_region_id_planet_regions_id_fk" FOREIGN KEY ("origin_region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "languages_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_origin_region_id_planet_regions_id_fk" FOREIGN KEY ("origin_region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_destination_region_id_planet_regions_id_fk" FOREIGN KEY ("destination_region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_results" ADD CONSTRAINT "moderation_results_contribution_id_user_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."user_contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_results" ADD CONSTRAINT "moderation_results_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_regions" ADD CONSTRAINT "planet_regions_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_regions" ADD CONSTRAINT "planet_regions_biome_id_biomes_id_fk" FOREIGN KEY ("biome_id") REFERENCES "public"."biomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_ticks" ADD CONSTRAINT "simulation_ticks_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species" ADD CONSTRAINT "species_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species" ADD CONSTRAINT "species_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_snapshots" ADD CONSTRAINT "timeline_snapshots_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_routes" ADD CONSTRAINT "trade_routes_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_routes" ADD CONSTRAINT "trade_routes_origin_city_id_cities_id_fk" FOREIGN KEY ("origin_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_routes" ADD CONSTRAINT "trade_routes_destination_city_id_cities_id_fk" FOREIGN KEY ("destination_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contributions" ADD CONSTRAINT "user_contributions_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contributions" ADD CONSTRAINT "user_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contributions" ADD CONSTRAINT "user_contributions_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wars" ADD CONSTRAINT "wars_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_contribution_id_user_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."user_contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_memory" ADD CONSTRAINT "world_memory_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "climate_cells_region_unique" ON "climate_cells" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "planet_regions_planet_index_unique" ON "planet_regions" USING btree ("planet_id","region_index");--> statement-breakpoint
CREATE INDEX "planet_regions_planet_biome_idx" ON "planet_regions" USING btree ("planet_id","biome_id");--> statement-breakpoint
CREATE UNIQUE INDEX "simulation_ticks_planet_tick_unique" ON "simulation_ticks" USING btree ("planet_id","tick");--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_snapshots_planet_tick_unique" ON "timeline_snapshots" USING btree ("planet_id","tick");--> statement-breakpoint
CREATE UNIQUE INDEX "user_contributions_idempotency_unique" ON "user_contributions" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "world_events_planet_sequence_unique" ON "world_events" USING btree ("planet_id","sequence");--> statement-breakpoint
CREATE INDEX "world_events_planet_tick_idx" ON "world_events" USING btree ("planet_id","tick");--> statement-breakpoint
CREATE INDEX "world_events_contribution_idx" ON "world_events" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "world_memory_planet_entity_idx" ON "world_memory" USING btree ("planet_id","entity_id");