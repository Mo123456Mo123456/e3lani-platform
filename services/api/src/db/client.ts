import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema.js';

const defaultDbPath = path.resolve(
  process.env.SQLITE_PATH || path.join(process.cwd(), '../../data/planet.db'),
);

type AppDrizzle = BetterSQLite3Database<typeof schema>;

let sqlite: SqliteDatabase | null = null;
let dbInstance: AppDrizzle | null = null;

export function getSqlitePath(override?: string): string {
  return override || process.env.SQLITE_PATH || defaultDbPath;
}

export function createDb(dbPath?: string): { db: AppDrizzle; sqlite: SqliteDatabase; path: string } {
  const resolved = getSqlitePath(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const conn = new Database(resolved);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  const db = drizzle(conn, { schema });
  sqlite = conn;
  dbInstance = db;
  return { db, sqlite: conn, path: resolved };
}

export function getDb(): AppDrizzle {
  if (!dbInstance || !sqlite) {
    const created = createDb();
    sqlite = created.sqlite;
    dbInstance = created.db;
  }
  return dbInstance;
}

export function getSqlite(): SqliteDatabase {
  if (!sqlite) getDb();
  return sqlite!;
}

export function resetDbForTests(dbPath: string): { db: AppDrizzle; sqlite: SqliteDatabase; path: string } {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
  }
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  return createDb(dbPath);
}

export type AppDb = AppDrizzle;
