import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createGzip, gunzipSync } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { audit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import { AppError, notFound } from '../../core/errors.js';
import { one, rows, withTransaction } from '../../db/pool.js';

/**
 * نسخة احتياطية محمولة بصيغة JSON مضغوطة.
 *
 * لماذا JSON وليس pg_dump فقط؟ لأنها لا تحتاج أدوات خارجية داخل الحاوية،
 * وتُستعاد على أي نسخة PostgreSQL، ويمكن للشركة قراءتها والتحقق منها بنفسها.
 * (نسخة pg_dump تبقى متاحة للشركة عبر أمر موثّق في دليل النسخ الاحتياطي.)
 */

export const BACKUP_FORMAT_VERSION = 1;

/** ترتيب الجداول يحترم المفاتيح الأجنبية عند الاستعادة. */
const TABLES: { name: string; geo?: string[] }[] = [
  { name: 'companies' },
  { name: 'users' },
  { name: 'settings' },
  { name: 'vehicles', geo: ['last_location'] },
  { name: 'workers' },
  { name: 'bins', geo: ['location'] },
  { name: 'qr_tokens' },
  { name: 'devices' },
  { name: 'device_bindings' },
  { name: 'activation_codes' },
  { name: 'route_sessions' },
  { name: 'route_points', geo: ['location'] },
  { name: 'scans', geo: ['location'] },
  { name: 'scan_attempts', geo: ['location'] },
  { name: 'sla_contracts' },
  { name: 'reports' },
  { name: 'report_items' },
  { name: 'audit_logs' },
  { name: 'backups' },
];

const SEQUENCES = ['bin_public_seq', 'scan_chain_seq', 'report_no_seq'];

export interface BackupFile {
  format: 'vero-backup';
  version: number;
  createdAt: string;
  veroVersion: string;
  companyName: string;
  tables: Record<string, Record<string, unknown>[]>;
  sequences: Record<string, number>;
  counts: Record<string, number>;
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function columnsOf(table: string): Promise<string[]> {
  const list = await rows<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  return list.map((r) => r.column_name);
}

/** يبني قائمة SELECT تحوّل أعمدة geography إلى نص WKT حتى تُخزَّن في JSON. */
function selectList(cols: string[], geo: string[] = []): string {
  return cols
    .map((c) =>
      geo.includes(c) ? `ST_AsText(${c}::geometry) AS ${c}` : `"${c}"`,
    )
    .join(', ');
}

export async function createBackup(ctx: Ctx): Promise<{
  id: string;
  filename: string;
  sizeBytes: number;
}> {
  const company = await one<{ name: string }>('SELECT name FROM companies LIMIT 1');
  const dir = resolve(env.backupDir);
  await ensureDir(dir);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `vero-backup-${stamp}.json.gz`;
  const filePath = join(dir, filename);

  const record = await one<{ id: string }>(
    `INSERT INTO backups (company_id, filename, kind, status, created_by)
     VALUES ($1,$2,'MANUAL','PENDING',$3) RETURNING id`,
    [ctx.companyId, filename, ctx.actor?.kind === 'user' ? ctx.actor.id : null],
  );
  if (!record) throw new AppError('INTERNAL', 'تعذّر تسجيل النسخة الاحتياطية');

  try {
    const data: BackupFile = {
      format: 'vero-backup',
      version: BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      veroVersion: env.version,
      companyName: company?.name ?? '',
      tables: {},
      sequences: {},
      counts: {},
    };

    for (const t of TABLES) {
      const cols = await columnsOf(t.name);
      if (cols.length === 0) continue;
      const list = await rows(`SELECT ${selectList(cols, t.geo)} FROM ${t.name}`);
      data.tables[t.name] = list;
      data.counts[t.name] = list.length;
    }
    for (const seq of SEQUENCES) {
      const r = await one<{ last_value: number }>(`SELECT last_value FROM ${seq}`);
      data.sequences[seq] = r?.last_value ?? 1;
    }

    await pipeline(
      Readable.from([JSON.stringify(data)]),
      createGzip({ level: 9 }),
      createWriteStream(filePath),
    );

    const st = await stat(filePath);
    await one('UPDATE backups SET status = $2, size_bytes = $3 WHERE id = $1', [
      record.id,
      'READY',
      st.size,
    ]);
    await audit(ctx, {
      action: 'backup.create',
      entity: 'backup',
      entityId: record.id,
      after: { filename, sizeBytes: st.size, counts: data.counts },
    });

    return { id: record.id, filename, sizeBytes: st.size };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await one('UPDATE backups SET status = $2, error = $3 WHERE id = $1', [
      record.id,
      'FAILED',
      message,
    ]);
    throw new AppError('INTERNAL', `فشل إنشاء النسخة الاحتياطية: ${message}`);
  }
}

export interface BackupListItem {
  id: string;
  filename: string;
  sizeBytes: number;
  kind: string;
  status: string;
  error: string | null;
  createdAt: string;
  createdByName: string | null;
  available: boolean;
}

export async function listBackups(companyId: string): Promise<BackupListItem[]> {
  const list = await rows<{
    id: string;
    filename: string;
    size_bytes: number;
    kind: string;
    status: string;
    error: string | null;
    created_at: Date;
    created_by_name: string | null;
  }>(
    `SELECT b.id, b.filename, b.size_bytes, b.kind, b.status, b.error, b.created_at,
            u.full_name AS created_by_name
       FROM backups b LEFT JOIN users u ON u.id = b.created_by
      WHERE b.company_id = $1 ORDER BY b.created_at DESC LIMIT 200`,
    [companyId],
  );
  const dir = resolve(env.backupDir);
  return list.map((b) => ({
    id: b.id,
    filename: b.filename,
    sizeBytes: b.size_bytes,
    kind: b.kind,
    status: b.status,
    error: b.error,
    createdAt: b.created_at.toISOString(),
    createdByName: b.created_by_name,
    available: existsSync(join(dir, basename(b.filename))),
  }));
}

export async function backupFilePath(companyId: string, id: string): Promise<string> {
  const row = await one<{ filename: string; status: string }>(
    'SELECT filename, status FROM backups WHERE id = $1 AND company_id = $2',
    [id, companyId],
  );
  if (!row) throw notFound('النسخة الاحتياطية غير موجودة');
  if (row.status !== 'READY') throw new AppError('CONFLICT', 'النسخة الاحتياطية غير جاهزة');
  // basename يمنع أي محاولة للخروج من مجلد النسخ عبر مسار نسبي
  const p = join(resolve(env.backupDir), basename(row.filename));
  if (!existsSync(p)) throw notFound('ملف النسخة الاحتياطية غير موجود على القرص');
  return p;
}

export async function deleteBackup(ctx: Ctx, id: string): Promise<void> {
  const row = await one<{ filename: string }>(
    'SELECT filename FROM backups WHERE id = $1 AND company_id = $2',
    [id, ctx.companyId],
  );
  if (!row) throw notFound('النسخة الاحتياطية غير موجودة');
  const p = join(resolve(env.backupDir), basename(row.filename));
  if (existsSync(p)) await unlink(p);
  await one('DELETE FROM backups WHERE id = $1', [id]);
  await audit(ctx, {
    action: 'backup.delete',
    entity: 'backup',
    entityId: id,
    before: { filename: row.filename },
  });
}

export interface RestoreResult {
  restored: Record<string, number>;
  backupCreatedAt: string;
  companyName: string;
}

export function parseBackup(buffer: Buffer): BackupFile {
  let json: string;
  try {
    // نقبل الملف مضغوطًا أو غير مضغوط
    json =
      buffer[0] === 0x1f && buffer[1] === 0x8b
        ? gunzipSync(buffer).toString('utf8')
        : buffer.toString('utf8');
  } catch {
    throw new AppError('BAD_REQUEST', 'تعذّر فك ضغط ملف النسخة الاحتياطية');
  }
  let data: BackupFile;
  try {
    data = JSON.parse(json) as BackupFile;
  } catch {
    throw new AppError('BAD_REQUEST', 'ملف النسخة الاحتياطية ليس بصيغة JSON صالحة');
  }
  if (data.format !== 'vero-backup') {
    throw new AppError('BAD_REQUEST', 'الملف ليس نسخة احتياطية من VERO');
  }
  if (data.version > BACKUP_FORMAT_VERSION) {
    throw new AppError(
      'BAD_REQUEST',
      `صيغة النسخة (${data.version}) أحدث من هذا الإصدار (${BACKUP_FORMAT_VERSION}). حدّث النظام أولًا.`,
    );
  }
  return data;
}

/**
 * استعادة كاملة. تُنفَّذ داخل معاملة واحدة: إما تنجح بالكامل أو لا يتغيّر شيء.
 * البيانات الحالية تُمحى بالكامل — هذا إجراء مدمِّر ومقصود.
 */
export async function restoreBackup(ctx: Ctx, buffer: Buffer): Promise<RestoreResult> {
  const data = parseBackup(buffer);
  const restored: Record<string, number> = {};

  await withTransaction(async (tx) => {
    // المراجع الدائرية بين الجداول تجعل أي ترتيب إدخال غير كافٍ وحده،
    // فنؤجّل فحص المفاتيح الأجنبية إلى لحظة الالتزام (الفحص يبقى كاملًا).
    await tx.query('SET CONSTRAINTS ALL DEFERRED');

    await tx.query(`
      TRUNCATE TABLE
        audit_logs, backups, report_items, reports, sla_contracts,
        scan_attempts, scans, route_points, route_sessions,
        activation_codes, device_bindings, devices,
        qr_tokens, bins, workers, vehicles,
        refresh_tokens, users, settings, companies
      CASCADE
    `);

    for (const t of TABLES) {
      const list = data.tables[t.name];
      if (!list || list.length === 0) {
        restored[t.name] = 0;
        continue;
      }
      const cols = await columnsOf(t.name);
      const present = cols.filter((c) => Object.prototype.hasOwnProperty.call(list[0]!, c));
      if (present.length === 0) {
        restored[t.name] = 0;
        continue;
      }

      const geo = t.geo ?? [];
      const placeholders = present
        .map((c, i) =>
          geo.includes(c)
            ? `CASE WHEN $${i + 1}::text IS NULL THEN NULL
                    ELSE ST_SetSRID(ST_GeomFromText($${i + 1}::text),4326)::geography END`
            : `$${i + 1}`,
        )
        .join(', ');
      const sql = `INSERT INTO ${t.name} (${present
        .map((c) => `"${c}"`)
        .join(', ')}) VALUES (${placeholders})`;

      for (const row of list) {
        const values = present.map((c) => {
          const v = (row as Record<string, unknown>)[c];
          // jsonb / مصفوفات JS تُمرَّر كنص JSON، ومصفوفات النصوص تُمرَّر كما هي لـ pg
          if (v !== null && typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
          return v ?? null;
        });
        await tx.query(sql, values);
      }
      restored[t.name] = list.length;
    }

    for (const [seq, value] of Object.entries(data.sequences ?? {})) {
      if (!SEQUENCES.includes(seq)) continue;
      await tx.query('SELECT setval($1, $2, true)', [seq, Math.max(1, Number(value) || 1)]);
    }
  });

  const company = await one<{ id: string }>('SELECT id FROM companies LIMIT 1');
  const restoredCtx: Ctx = { ...ctx, companyId: company?.id ?? ctx.companyId };
  await audit(restoredCtx, {
    action: 'backup.restore',
    entity: 'backup',
    after: { backupCreatedAt: data.createdAt, restored },
  });

  return {
    restored,
    backupCreatedAt: data.createdAt,
    companyName: data.companyName,
  };
}

/** نسخة تلقائية دورية — تُفعَّل بمتغير البيئة AUTO_BACKUP_ENABLED=1 */
export function startAutoBackup(): NodeJS.Timeout | null {
  if (!env.autoBackupCron) return null;
  const intervalMs = Math.max(1, env.autoBackupIntervalHours) * 3_600_000;
  const run = async () => {
    try {
      const company = await one<{ id: string }>('SELECT id FROM companies LIMIT 1');
      if (!company) return;
      const ctx: Ctx = { companyId: company.id, actor: null, meta: {} };
      const res = await createBackup(ctx);
      await one("UPDATE backups SET kind = 'AUTO' WHERE id = $1", [res.id]);
      console.log(`[VERO] نسخة احتياطية تلقائية: ${res.filename}`);
    } catch (err) {
      console.error(
        '[VERO] فشل النسخ الاحتياطي التلقائي:',
        err instanceof Error ? err.message : String(err),
      );
    }
  };
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return timer;
}

export async function writeBackupFile(filename: string, buffer: Buffer): Promise<string> {
  const dir = resolve(env.backupDir);
  await ensureDir(dir);
  const p = join(dir, basename(filename));
  await writeFile(p, buffer);
  return p;
}

export function readBackupStream(path: string): NodeJS.ReadableStream {
  return createReadStream(path);
}
