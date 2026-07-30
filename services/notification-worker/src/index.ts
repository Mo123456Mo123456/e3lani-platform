/**
 * Notification worker — polls world_events and notifies contribution owners.
 *
 * Rules:
 * - species depends on plant
 * - civ uses invention
 * - war caused by element
 * - extinction / spread / long-term effect
 */
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.SQLITE_PATH || path.resolve(process.cwd(), '../../data/planet.db');
const pollMs = Number(process.env.NOTIFICATION_POLL_MS || 5000);
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4000';

const RULE_TYPES = new Set([
  'species_depends_on_plant',
  'civ_uses_invention',
  'war_caused_by_element',
  'extinction',
  'spread',
  'long_term_effect',
  'contribution_species',
  'contribution_plant',
  'contribution_invention',
  'contribution_element',
]);

const TITLE_AR: Record<string, string> = {
  species_depends_on_plant: 'نوعك يعتمد على نبات',
  civ_uses_invention: 'حضارة تتبنى اختراعك',
  war_caused_by_element: 'حرب ناتجة عن عنصر ساهمت به',
  extinction: 'انقراض مرتبط بمساهمتك',
  spread: 'انتشار ناتج عن مساهمتك',
  long_term_effect: 'أثر طويل الأمد لمساهمتك',
  contribution_species: 'تحديث نوع حي',
  contribution_plant: 'تحديث نبات',
  contribution_invention: 'تحديث اختراع',
  contribution_element: 'تحديث عنصر',
};

function openDb() {
  if (!fs.existsSync(dbPath)) {
    console.warn(`DB not found at ${dbPath} — waiting...`);
    return null;
  }
  const db = new Database(dbPath, { readonly: false, fileMustExist: true });
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_worker_cursor (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_created_at TEXT NOT NULL DEFAULT '1970-01-01'
    );
    INSERT OR IGNORE INTO notification_worker_cursor (id, last_created_at) VALUES (1, '1970-01-01');
  `);
  return db;
}

type EventRow = {
  id: string;
  planet_id: string;
  type: string;
  title: string;
  description: string | null;
  contribution_id: string | null;
  created_at: string;
};

function processBatch(db: Database.Database) {
  const cursor = db.prepare('SELECT last_created_at FROM notification_worker_cursor WHERE id = 1').get() as {
    last_created_at: string;
  };

  const events = db
    .prepare(
      `SELECT id, planet_id, type, title, description, contribution_id, created_at
       FROM world_events
       WHERE created_at > ?
       ORDER BY created_at ASC
       LIMIT 100`,
    )
    .all(cursor.last_created_at) as EventRow[];

  if (!events.length) return 0;

  const insertNotif = db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, payload, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
  );
  const findOwner = db.prepare(`SELECT user_id FROM user_contributions WHERE id = ?`);

  let created = 0;
  const tx = db.transaction(() => {
    for (const ev of events) {
      if (!RULE_TYPES.has(ev.type) || !ev.contribution_id) continue;
      const owner = findOwner.get(ev.contribution_id) as { user_id: string } | undefined;
      if (!owner) continue;

      // avoid duplicate for same event+user
      const exists = db
        .prepare(
          `SELECT id FROM notifications WHERE user_id = ? AND type = ? AND json_extract(payload, '$.eventId') = ? LIMIT 1`,
        )
        .get(owner.user_id, ev.type, ev.id);
      if (exists) continue;

      insertNotif.run(
        nanoid(),
        owner.user_id,
        ev.type,
        TITLE_AR[ev.type] || ev.title,
        ev.description || ev.title,
        JSON.stringify({
          eventId: ev.id,
          planetId: ev.planet_id,
          contributionId: ev.contribution_id,
        }),
      );
      created++;
    }

    const last = events[events.length - 1]!;
    db.prepare('UPDATE notification_worker_cursor SET last_created_at = ? WHERE id = 1').run(last.created_at);
  });
  tx();
  return created;
}

async function tryHttpFallback() {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function loop() {
  console.log(`Notification worker polling ${dbPath} every ${pollMs}ms`);
  await tryHttpFallback();
  setInterval(() => {
    try {
      const db = openDb();
      if (!db) return;
      const n = processBatch(db);
      if (n > 0) console.log(`Created ${n} notifications`);
      db.close();
    } catch (err) {
      console.error('worker tick failed', err);
    }
  }, pollMs);
}

loop();
