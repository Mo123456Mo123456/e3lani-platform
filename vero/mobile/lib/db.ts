import * as SQLite from 'expo-sqlite';

/**
 * قاعدة بيانات محلية للعمل بدون إنترنت.
 *
 * المبدأ: كل عملية مسح وكل نقطة مسار تُكتب هنا **أولًا** ثم تُرسل.
 * هكذا لا تُفقد أي عملية حتى لو انقطع الاتصال أو أُغلق التطبيق فجأة.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS pending_scans (
  client_uuid  TEXT PRIMARY KEY,
  token        TEXT NOT NULL,
  bin_label    TEXT,
  lat          REAL NOT NULL,
  lon          REAL NOT NULL,
  accuracy_m   REAL,
  scanned_at   TEXT NOT NULL,
  session_id   TEXT,
  created_at   TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT
);

CREATE TABLE IF NOT EXISTS pending_points (
  client_uuid  TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  lat          REAL NOT NULL,
  lon          REAL NOT NULL,
  speed_mps    REAL,
  accuracy_m   REAL,
  recorded_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_history (
  client_uuid  TEXT PRIMARY KEY,
  bin_label    TEXT,
  status       TEXT NOT NULL,
  counted      INTEGER NOT NULL DEFAULT 0,
  distance_m   REAL,
  message      TEXT,
  service_day  TEXT,
  synced_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pending_points_session ON pending_points(session_id, recorded_at);
CREATE INDEX IF NOT EXISTS scan_history_day ON scan_history(service_day);
`;

export async function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const d = await SQLite.openDatabaseAsync('vero.db');
      await d.execAsync(SCHEMA);
      return d;
    })();
  }
  return dbPromise;
}

export interface PendingScan {
  client_uuid: string;
  token: string;
  bin_label: string | null;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  scanned_at: string;
  session_id: string | null;
  attempts: number;
  last_error: string | null;
}

export interface PendingPoint {
  client_uuid: string;
  session_id: string;
  lat: number;
  lon: number;
  speed_mps: number | null;
  accuracy_m: number | null;
  recorded_at: string;
}

export interface HistoryRow {
  client_uuid: string;
  bin_label: string | null;
  status: string;
  counted: number;
  distance_m: number | null;
  message: string | null;
  service_day: string | null;
  synced_at: string;
}

export async function queueScan(s: Omit<PendingScan, 'attempts' | 'last_error'>): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR IGNORE INTO pending_scans
       (client_uuid, token, bin_label, lat, lon, accuracy_m, scanned_at, session_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      s.client_uuid,
      s.token,
      s.bin_label,
      s.lat,
      s.lon,
      s.accuracy_m,
      s.scanned_at,
      s.session_id,
      new Date().toISOString(),
    ],
  );
}

export async function pendingScans(limit = 100): Promise<PendingScan[]> {
  const d = await db();
  return d.getAllAsync<PendingScan>(
    `SELECT client_uuid, token, bin_label, lat, lon, accuracy_m, scanned_at, session_id,
            attempts, last_error
       FROM pending_scans ORDER BY scanned_at LIMIT ?`,
    [limit],
  );
}

export async function pendingScanCount(): Promise<number> {
  const d = await db();
  const r = await d.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM pending_scans');
  return r?.n ?? 0;
}

export async function removeScan(clientUuid: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM pending_scans WHERE client_uuid = ?', [clientUuid]);
}

export async function markScanFailed(clientUuid: string, error: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    'UPDATE pending_scans SET attempts = attempts + 1, last_error = ? WHERE client_uuid = ?',
    [error.slice(0, 300), clientUuid],
  );
}

export async function queuePoint(p: PendingPoint): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR IGNORE INTO pending_points
       (client_uuid, session_id, lat, lon, speed_mps, accuracy_m, recorded_at)
     VALUES (?,?,?,?,?,?,?)`,
    [p.client_uuid, p.session_id, p.lat, p.lon, p.speed_mps, p.accuracy_m, p.recorded_at],
  );
}

export async function pendingPoints(sessionId: string, limit = 500): Promise<PendingPoint[]> {
  const d = await db();
  return d.getAllAsync<PendingPoint>(
    'SELECT * FROM pending_points WHERE session_id = ? ORDER BY recorded_at LIMIT ?',
    [sessionId, limit],
  );
}

export async function pendingPointCount(): Promise<number> {
  const d = await db();
  const r = await d.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM pending_points');
  return r?.n ?? 0;
}

export async function removePoints(uuids: string[]): Promise<void> {
  if (uuids.length === 0) return;
  const d = await db();
  const marks = uuids.map(() => '?').join(',');
  await d.runAsync(`DELETE FROM pending_points WHERE client_uuid IN (${marks})`, uuids);
}

export async function addHistory(h: HistoryRow): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR REPLACE INTO scan_history
       (client_uuid, bin_label, status, counted, distance_m, message, service_day, synced_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      h.client_uuid,
      h.bin_label,
      h.status,
      h.counted,
      h.distance_m,
      h.message,
      h.service_day,
      h.synced_at,
    ],
  );
}

export async function history(limit = 60): Promise<HistoryRow[]> {
  const d = await db();
  return d.getAllAsync<HistoryRow>(
    'SELECT * FROM scan_history ORDER BY synced_at DESC LIMIT ?',
    [limit],
  );
}

export async function countedToday(serviceDay: string): Promise<number> {
  const d = await db();
  const r = await d.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM scan_history WHERE service_day = ? AND counted = 1',
    [serviceDay],
  );
  return r?.n ?? 0;
}

/** يُستخدم عند إلغاء تفعيل الجهاز أو إعادة ربطه بعامل آخر. */
export async function wipeLocal(): Promise<void> {
  const d = await db();
  await d.execAsync(
    'DELETE FROM pending_scans; DELETE FROM pending_points; DELETE FROM scan_history;',
  );
}
