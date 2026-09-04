import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

// المسافات والإحداثيات تعود كأرقام لا كنصوص
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
// DATE يبقى نصًا `YYYY-MM-DD` حتى لا يتغيّر اليوم بسبب المنطقة الزمنية للعملية
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // لا نُسقط العملية: pg يعيد إنشاء الاتصال
  console.error('[VERO] خطأ في اتصال قاعدة البيانات:', err.message);
});

export type QueryParams = readonly unknown[];

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: QueryParams = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

export async function rows<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: QueryParams = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as unknown[]);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: QueryParams = [],
): Promise<T | null> {
  const res = await pool.query<T>(text, params as unknown[]);
  return res.rows[0] ?? null;
}

export interface Tx {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: QueryParams,
  ): Promise<pg.QueryResult<T>>;
  rows<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: QueryParams,
  ): Promise<T[]>;
  one<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: QueryParams,
  ): Promise<T | null>;
}

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const tx: Tx = {
    query: (text, params = []) => client.query(text, params as unknown[]),
    rows: async (text, params = []) => (await client.query(text, params as unknown[])).rows,
    one: async (text, params = []) =>
      (await client.query(text, params as unknown[])).rows[0] ?? null,
  };
  try {
    await client.query('BEGIN');
    const out = await fn(tx as Tx);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* الاتصال قد يكون سقط أصلًا */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
