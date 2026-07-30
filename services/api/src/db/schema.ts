import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  roles: text("roles", { mode: "json" }).notNull(),
  refreshTokenVersion: integer("refresh_token_version").notNull().default(0),
  createdAt: text("created_at").notNull()
});

export const planets = sqliteTable("planets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  seed: text("seed").notNull(),
  ageYears: integer("age_years").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const worldEvents = sqliteTable("world_events", {
  id: text("id").primaryKey(),
  planetId: text("planet_id").notNull(),
  tick: integer("tick").notNull(),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const contributions = sqliteTable("contributions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  planetId: text("planet_id").notNull(),
  category: text("category").notNull(),
  prompt: text("prompt").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull()
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  planetId: text("planet_id").notNull(),
  eventId: text("event_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull()
});

export const stateSnapshots = sqliteTable("state_snapshots", {
  id: text("id").primaryKey(),
  planetId: text("planet_id").notNull(),
  tick: integer("tick").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull()
});
