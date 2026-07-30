CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"sandbox" boolean DEFAULT false NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "biomes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "causal_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"from_event_id" uuid NOT NULL,
	"to_event_id" uuid NOT NULL,
	"relation" text DEFAULT 'caused' NOT NULL,
	"strength" real DEFAULT 1 NOT NULL,
	"delay_ticks" integer DEFAULT 0 NOT NULL,
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"civilization_id" uuid,
	"population" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civilizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"government" text,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "climate_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"tick" integer DEFAULT 0 NOT NULL,
	"temperature" real NOT NULL,
	"moisture" real NOT NULL,
	"pressure" real,
	"wind" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"civilization_id" uuid,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diseases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contagion" real DEFAULT 0 NOT NULL,
	"lethality" real DEFAULT 0 NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"civilization_id" uuid,
	"vocabulary" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"civilization_id" uuid,
	"from_region_id" uuid,
	"to_region_id" uuid,
	"population" integer DEFAULT 0 NOT NULL,
	"cause" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"contribution_id" uuid,
	"allowed" boolean NOT NULL,
	"needs_review" boolean NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planet_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"cell_index" integer NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"biome" text NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"elevation" real NOT NULL,
	"temperature" real NOT NULL,
	"moisture" real NOT NULL,
	"fertility" real NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"pollution" real DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"name_en" text,
	"seed" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"current_tick" integer DEFAULT 0 NOT NULL,
	"current_year" double precision DEFAULT 0 NOT NULL,
	"tick_unit" text DEFAULT 'year' NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"coverage" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"level" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"renewable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"name" text PRIMARY KEY NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_ticks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"tick" integer NOT NULL,
	"unit" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'living' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"name" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"civilization_id" uuid,
	"level" integer DEFAULT 1 NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"tick" integer NOT NULL,
	"state" jsonb NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"from_city_id" uuid,
	"to_city_id" uuid,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"category" text NOT NULL,
	"idea" text,
	"structured" jsonb NOT NULL,
	"location" jsonb NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_name" text NOT NULL,
	CONSTRAINT "user_roles_user_id_role_name_pk" PRIMARY KEY("user_id","role_name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'registered' NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"refresh_token_hash" text,
	"refresh_expires_at" timestamp with time zone,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"belligerent_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at_tick" integer NOT NULL,
	"ended_at_tick" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_id" uuid NOT NULL,
	"region_id" uuid,
	"contribution_id" uuid,
	"user_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"title_en" text,
	"description" text NOT NULL,
	"tick" integer NOT NULL,
	"sim_year" double precision NOT NULL,
	"importance" real NOT NULL,
	"location" jsonb,
	"cause_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliances" ADD CONSTRAINT "alliances_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "causal_links" ADD CONSTRAINT "causal_links_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "causal_links" ADD CONSTRAINT "causal_links_from_event_id_world_events_id_fk" FOREIGN KEY ("from_event_id") REFERENCES "public"."world_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "causal_links" ADD CONSTRAINT "causal_links_to_event_id_world_events_id_fk" FOREIGN KEY ("to_event_id") REFERENCES "public"."world_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civilizations" ADD CONSTRAINT "civilizations_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civilizations" ADD CONSTRAINT "civilizations_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climate_cells" ADD CONSTRAINT "climate_cells_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climate_cells" ADD CONSTRAINT "climate_cells_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "languages_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "languages_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "languages_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_from_region_id_planet_regions_id_fk" FOREIGN KEY ("from_region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_to_region_id_planet_regions_id_fk" FOREIGN KEY ("to_region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_results" ADD CONSTRAINT "moderation_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_results" ADD CONSTRAINT "moderation_results_contribution_id_user_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."user_contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_regions" ADD CONSTRAINT "planet_regions_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_ticks" ADD CONSTRAINT "simulation_ticks_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species" ADD CONSTRAINT "species_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species" ADD CONSTRAINT "species_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_civilization_id_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."civilizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_snapshots" ADD CONSTRAINT "timeline_snapshots_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_snapshots" ADD CONSTRAINT "timeline_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_routes" ADD CONSTRAINT "trade_routes_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_routes" ADD CONSTRAINT "trade_routes_from_city_id_cities_id_fk" FOREIGN KEY ("from_city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_routes" ADD CONSTRAINT "trade_routes_to_city_id_cities_id_fk" FOREIGN KEY ("to_city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contributions" ADD CONSTRAINT "user_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contributions" ADD CONSTRAINT "user_contributions_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_name_roles_name_fk" FOREIGN KEY ("role_name") REFERENCES "public"."roles"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wars" ADD CONSTRAINT "wars_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_region_id_planet_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."planet_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_contribution_id_user_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."user_contributions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "causal_link_unique" ON "causal_links" USING btree ("planet_id","from_event_id","to_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "climate_cell_tick_unique" ON "climate_cells" USING btree ("planet_id","region_id","tick");--> statement-breakpoint
CREATE UNIQUE INDEX "planet_regions_cell_unique" ON "planet_regions" USING btree ("planet_id","cell_index");--> statement-breakpoint
CREATE UNIQUE INDEX "planets_seed_unique" ON "planets" USING btree ("seed");--> statement-breakpoint
CREATE UNIQUE INDEX "simulation_tick_unique" ON "simulation_ticks" USING btree ("planet_id","tick");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_planet_tick_unique" ON "timeline_snapshots" USING btree ("planet_id","tick");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");