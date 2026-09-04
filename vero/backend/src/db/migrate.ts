import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, 'migrations');

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * مُهاجر بسيط وحتمي: يطبّق ملفات migrations/*.sql بالترتيب الأبجدي داخل معاملة واحدة لكل ملف،
 * ويسجّلها في جدول schema_migrations. تشغيله مرة أخرى لا يعيد تطبيق ما طُبّق.
 */
export async function runMigrations(log: (m: string) => void = () => {}): Promise<MigrationResult> {
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    // قفل استشاري يمنع تصادم مثيلين يشتغلان معًا
    await client.query('SELECT pg_advisory_lock($1)', [724_100_001]);

    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (r) => r.name,
      ),
    );

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) {
        skipped.push(file);
        continue;
      }
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      log(`[VERO] تطبيق الهجرة ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(
          `[VERO] فشلت الهجرة ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { applied, skipped };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [724_100_001]);
    } catch {
      /* ignore */
    }
    client.release();
  }
}

/** يُستخدم في الاختبارات فقط: تفريغ كل بيانات التطبيق مع إبقاء المخطط. */
export async function truncateAll(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      audit_logs, backups, report_items, reports, sla_contracts,
      scan_attempts, scans, route_points, route_sessions,
      activation_codes, device_bindings, devices,
      qr_tokens, bins, workers, vehicles,
      refresh_tokens, users, settings, companies
    RESTART IDENTITY CASCADE
  `);
  await pool.query('ALTER SEQUENCE bin_public_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE scan_chain_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE report_no_seq RESTART WITH 1');
}
