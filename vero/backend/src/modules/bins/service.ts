import { audit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import { AppError, conflict, notFound } from '../../core/errors.js';
import { isValidLatLon } from '../../core/geo.js';
import { buildQrToken, newNonce } from '../../core/qr-token.js';
import { one, rows, withTransaction, type Tx } from '../../db/pool.js';
import { requireCompany } from '../company/service.js';

const UNIQUE_VIOLATION = '23505';

export interface BinRow {
  id: string;
  company_id: string;
  public_id: string;
  name: string | null;
  sector: string | null;
  area: string | null;
  address: string | null;
  gps_radius_m: number;
  status: 'ACTIVE' | 'DISABLED';
  qr_printed_at: Date | null;
  notes: string | null;
  created_at: Date;
  lat?: number;
  lon?: number;
}

export interface BinDto {
  id: string;
  publicId: string;
  name: string | null;
  sector: string | null;
  area: string | null;
  address: string | null;
  lat: number;
  lon: number;
  gpsRadiusM: number;
  status: string;
  qrPrintedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const SELECT_BIN = `
  SELECT b.*, ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lon
    FROM bins b
`;

export function toBinDto(r: BinRow): BinDto {
  return {
    id: r.id,
    publicId: r.public_id,
    name: r.name,
    sector: r.sector,
    area: r.area,
    address: r.address,
    lat: r.lat ?? 0,
    lon: r.lon ?? 0,
    gpsRadiusM: r.gps_radius_m,
    status: r.status,
    qrPrintedAt: r.qr_printed_at ? r.qr_printed_at.toISOString() : null,
    notes: r.notes,
    createdAt: r.created_at.toISOString(),
  };
}

/** يولّد رقم حاوية جديد بصيغة VR-000001. */
async function nextPublicId(tx: Tx): Promise<string> {
  const r = await tx.one<{ n: number }>("SELECT nextval('bin_public_seq')::int AS n");
  return `VR-${String(r!.n).padStart(6, '0')}`;
}

export interface BinInput {
  publicId?: string;
  name?: string | null;
  sector?: string | null;
  area?: string | null;
  address?: string | null;
  lat: number;
  lon: number;
  gpsRadiusM?: number | null;
  status?: 'ACTIVE' | 'DISABLED';
  notes?: string | null;
}

async function insertBin(
  tx: Tx,
  companyId: string,
  defaultRadius: number,
  input: BinInput,
): Promise<BinRow> {
  if (!isValidLatLon({ lat: input.lat, lon: input.lon })) {
    throw new AppError('VALIDATION_FAILED', 'إحداثيات غير صالحة', {
      lat: input.lat,
      lon: input.lon,
    });
  }
  const publicId = input.publicId?.trim().toUpperCase() || (await nextPublicId(tx));
  const radius = input.gpsRadiusM ?? defaultRadius;

  const bin = await tx.one<BinRow>(
    `INSERT INTO bins
       (company_id, public_id, name, sector, area, address, location, gps_radius_m, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6, ST_SetSRID(ST_MakePoint($7,$8),4326)::geography, $9,
             COALESCE($10,'ACTIVE'), $11)
     RETURNING *, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon`,
    [
      companyId,
      publicId,
      input.name ?? null,
      input.sector ?? null,
      input.area ?? null,
      input.address ?? null,
      input.lon,
      input.lat,
      radius,
      input.status ?? null,
      input.notes ?? null,
    ],
  );
  if (!bin) throw new AppError('INTERNAL', 'تعذّر إنشاء الحاوية');

  // كل حاوية تحصل على رمز QR ثابت فور إنشائها
  await tx.query(
    'INSERT INTO qr_tokens (company_id, bin_id, nonce) VALUES ($1,$2,$3)',
    [companyId, bin.id, newNonce()],
  );
  return bin;
}

export async function createBin(ctx: Ctx, input: BinInput): Promise<BinDto> {
  const company = await requireCompany();
  try {
    const bin = await withTransaction((tx) =>
      insertBin(tx, ctx.companyId, company.default_gps_radius_m, input),
    );
    await audit(ctx, {
      action: 'bin.create',
      entity: 'bin',
      entityId: bin.id,
      after: toBinDto(bin),
    });
    return toBinDto(bin);
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict(`رقم الحاوية مستخدم مسبقًا: ${input.publicId}`);
    }
    throw err;
  }
}

export async function getBin(companyId: string, id: string): Promise<BinRow> {
  const row = await one<BinRow>(`${SELECT_BIN} WHERE b.id = $1 AND b.company_id = $2`, [
    id,
    companyId,
  ]);
  if (!row) throw notFound('الحاوية غير موجودة');
  return row;
}

export async function getBinByPublicId(
  companyId: string,
  publicId: string,
): Promise<BinRow | null> {
  return one<BinRow>(`${SELECT_BIN} WHERE b.company_id = $1 AND upper(b.public_id) = upper($2)`, [
    companyId,
    publicId,
  ]);
}

export interface UpdateBinInput extends Partial<BinInput> {}

export async function updateBin(ctx: Ctx, id: string, input: UpdateBinInput): Promise<BinDto> {
  const before = await getBin(ctx.companyId, id);
  const hasCoords = input.lat !== undefined && input.lon !== undefined;
  if (hasCoords && !isValidLatLon({ lat: input.lat!, lon: input.lon! })) {
    throw new AppError('VALIDATION_FAILED', 'إحداثيات غير صالحة');
  }
  const after = await one<BinRow>(
    `UPDATE bins SET
       public_id    = COALESCE($3, public_id),
       name         = COALESCE($4, name),
       sector       = COALESCE($5, sector),
       area         = COALESCE($6, area),
       address      = COALESCE($7, address),
       gps_radius_m = COALESCE($8, gps_radius_m),
       status       = COALESCE($9, status),
       notes        = COALESCE($10, notes),
       location     = CASE WHEN $11::boolean
                           THEN ST_SetSRID(ST_MakePoint($12,$13),4326)::geography
                           ELSE location END,
       updated_at   = now()
     WHERE id = $1 AND company_id = $2
     RETURNING *, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon`,
    [
      id,
      ctx.companyId,
      input.publicId?.toUpperCase() ?? null,
      input.name ?? null,
      input.sector ?? null,
      input.area ?? null,
      input.address ?? null,
      input.gpsRadiusM ?? null,
      input.status ?? null,
      input.notes ?? null,
      hasCoords,
      input.lon ?? 0,
      input.lat ?? 0,
    ],
  );
  if (!after) throw notFound('الحاوية غير موجودة');
  await audit(ctx, {
    action: 'bin.update',
    entity: 'bin',
    entityId: id,
    before: toBinDto(before),
    after: toBinDto(after),
  });
  return toBinDto(after);
}

export async function deleteBin(ctx: Ctx, id: string): Promise<void> {
  const before = await getBin(ctx.companyId, id);
  await one('DELETE FROM bins WHERE id = $1 AND company_id = $2', [id, ctx.companyId]);
  await audit(ctx, {
    action: 'bin.delete',
    entity: 'bin',
    entityId: id,
    before: toBinDto(before),
  });
}

// ─────────────────────────── القوائم ───────────────────────────

export interface ListBinsQuery {
  q?: string;
  sector?: string;
  area?: string;
  status?: 'ACTIVE' | 'DISABLED';
  servicedOn?: string;
  serviced?: 'YES' | 'NO';
  page?: number;
  pageSize?: number;
}

export interface ListBinsResult {
  items: (BinDto & { servicedOnDay?: boolean; lastScanAt?: string | null })[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listBins(
  companyId: string,
  q: ListBinsQuery,
  todayDay: string,
): Promise<ListBinsResult> {
  const day = q.servicedOn ?? todayDay;
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, q.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const where: string[] = ['b.company_id = $1'];
  const params: unknown[] = [companyId, day];
  let p = 2;

  if (q.q) {
    p++;
    where.push(
      `(b.public_id ILIKE $${p} OR b.name ILIKE $${p} OR b.address ILIKE $${p} OR b.area ILIKE $${p})`,
    );
    params.push(`%${q.q}%`);
  }
  if (q.sector) {
    p++;
    where.push(`b.sector = $${p}`);
    params.push(q.sector);
  }
  if (q.area) {
    p++;
    where.push(`b.area = $${p}`);
    params.push(q.area);
  }
  if (q.status) {
    p++;
    where.push(`b.status = $${p}`);
    params.push(q.status);
  }
  if (q.serviced === 'YES') where.push('s.id IS NOT NULL');
  if (q.serviced === 'NO') where.push('s.id IS NULL');

  const base = `
    FROM bins b
    LEFT JOIN LATERAL (
      SELECT sc.id, sc.scanned_at FROM scans sc
       WHERE sc.bin_id = b.id AND sc.service_day = $2 AND sc.counted
       LIMIT 1
    ) s ON true
    WHERE ${where.join(' AND ')}
  `;

  const totalRow = await one<{ count: number }>(
    `SELECT count(*)::int AS count ${base}`,
    params,
  );

  const list = await rows<BinRow & { scan_id: string | null; scanned_at: Date | null }>(
    `SELECT b.*, ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lon,
            s.id AS scan_id, s.scanned_at
     ${base}
     ORDER BY b.public_id
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  return {
    items: list.map((r) => ({
      ...toBinDto(r),
      servicedOnDay: r.scan_id !== null,
      lastScanAt: r.scanned_at ? r.scanned_at.toISOString() : null,
    })),
    total: totalRow?.count ?? 0,
    page,
    pageSize,
  };
}

export type MapBinState = 'DONE' | 'PENDING' | 'REVIEW' | 'PROBLEM';

export interface MapBin {
  id: string;
  publicId: string;
  lat: number;
  lon: number;
  state: MapBinState;
  sector: string | null;
}

/** نقاط الخريطة: حالة كل حاوية في يوم محدد. */
export async function mapBins(companyId: string, day: string): Promise<MapBin[]> {
  return rows<MapBin>(
    `SELECT b.id,
            b.public_id AS "publicId",
            ST_Y(b.location::geometry) AS lat,
            ST_X(b.location::geometry) AS lon,
            b.sector,
            CASE
              WHEN b.status = 'DISABLED' THEN 'PROBLEM'
              WHEN done.id IS NOT NULL THEN 'DONE'
              WHEN susp.id IS NOT NULL THEN 'REVIEW'
              ELSE 'PENDING'
            END AS state
       FROM bins b
       LEFT JOIN LATERAL (
         SELECT s.id FROM scans s
          WHERE s.bin_id = b.id AND s.service_day = $2 AND s.counted LIMIT 1
       ) done ON true
       LEFT JOIN LATERAL (
         SELECT s.id FROM scans s
          WHERE s.bin_id = b.id AND s.service_day = $2 AND s.status = 'SUSPICIOUS' LIMIT 1
       ) susp ON true
      WHERE b.company_id = $1`,
    [companyId, day],
  );
}

export async function listSectors(companyId: string): Promise<string[]> {
  const list = await rows<{ sector: string }>(
    `SELECT DISTINCT sector FROM bins
      WHERE company_id = $1 AND sector IS NOT NULL AND sector <> ''
      ORDER BY sector`,
    [companyId],
  );
  return list.map((r) => r.sector);
}

// ─────────────────────────── الاستيراد ───────────────────────────

export interface ImportRowInput {
  publicId?: string;
  name?: string;
  sector?: string;
  area?: string;
  address?: string;
  lat: number;
  lon: number;
  gpsRadiusM?: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  failed: { row: number; publicId?: string; reason: string }[];
}

/**
 * استيراد دفعة حاويات. الصف الذي يحمل `publicId` موجودًا يُحدَّث (Upsert)،
 * والصف بلا `publicId` يُنشأ برقم جديد. الصفوف الفاشلة تُرجَع بأسبابها ولا توقف الدفعة.
 */
export async function importBins(ctx: Ctx, input: ImportRowInput[]): Promise<ImportResult> {
  const company = await requireCompany();
  const result: ImportResult = { created: 0, updated: 0, failed: [] };

  for (let i = 0; i < input.length; i++) {
    const raw = input[i]!;
    try {
      if (!isValidLatLon({ lat: raw.lat, lon: raw.lon })) {
        throw new AppError('VALIDATION_FAILED', 'إحداثيات غير صالحة');
      }
      const existing = raw.publicId
        ? await getBinByPublicId(ctx.companyId, raw.publicId)
        : null;

      if (existing) {
        await one(
          `UPDATE bins SET
             name = COALESCE($2,name), sector = COALESCE($3,sector), area = COALESCE($4,area),
             address = COALESCE($5,address),
             location = ST_SetSRID(ST_MakePoint($6,$7),4326)::geography,
             gps_radius_m = COALESCE($8, gps_radius_m), updated_at = now()
           WHERE id = $1`,
          [
            existing.id,
            raw.name ?? null,
            raw.sector ?? null,
            raw.area ?? null,
            raw.address ?? null,
            raw.lon,
            raw.lat,
            raw.gpsRadiusM ?? null,
          ],
        );
        result.updated++;
      } else {
        await withTransaction((tx) =>
          insertBin(tx, ctx.companyId, company.default_gps_radius_m, {
            publicId: raw.publicId,
            name: raw.name ?? null,
            sector: raw.sector ?? null,
            area: raw.area ?? null,
            address: raw.address ?? null,
            lat: raw.lat,
            lon: raw.lon,
            gpsRadiusM: raw.gpsRadiusM ?? null,
          }),
        );
        result.created++;
      }
    } catch (err) {
      result.failed.push({
        row: i + 1,
        publicId: raw.publicId,
        reason: err instanceof AppError ? err.message : (err as Error).message,
      });
    }
  }

  await audit(ctx, {
    action: 'bin.import',
    entity: 'bin',
    after: {
      created: result.created,
      updated: result.updated,
      failed: result.failed.length,
    },
  });
  return result;
}

/**
 * محلّل CSV بسيط يدعم علامات الاقتباس وفواصل الأسطر داخل الحقول،
 * ويتعرّف على العناوين العربية والإنجليزية.
 */
export function parseBinsCsv(text: string): ImportRowInput[] {
  const rowsOut: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',' || c === ';') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rowsOut.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rowsOut.push(row);
  }
  if (rowsOut.length === 0) return [];

  const header = rowsOut[0]!.map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const iId = idx('public_id', 'publicid', 'رقم الحاوية', 'رقم', 'id');
  const iName = idx('name', 'الاسم', 'الوصف', 'اسم');
  const iSector = idx('sector', 'القطاع');
  const iArea = idx('area', 'المنطقة');
  const iAddr = idx('address', 'العنوان');
  const iLat = idx('lat', 'latitude', 'خط العرض', 'العرض');
  const iLon = idx('lon', 'lng', 'longitude', 'خط الطول', 'الطول');
  const iRad = idx('radius', 'gps_radius_m', 'النطاق', 'نطاق');

  if (iLat < 0 || iLon < 0) {
    throw new AppError(
      'VALIDATION_FAILED',
      'الملف يجب أن يحتوي على عمودي الإحداثيات: lat و lon (أو خط العرض وخط الطول)',
    );
  }

  const out: ImportRowInput[] = [];
  for (let r = 1; r < rowsOut.length; r++) {
    const cells = rowsOut[r]!;
    if (cells.every((c) => c.trim() === '')) continue;
    const get = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '');
    out.push({
      publicId: get(iId) || undefined,
      name: get(iName) || undefined,
      sector: get(iSector) || undefined,
      area: get(iArea) || undefined,
      address: get(iAddr) || undefined,
      lat: Number(get(iLat)),
      lon: Number(get(iLon)),
      gpsRadiusM: get(iRad) ? Number(get(iRad)) : undefined,
    });
  }
  return out;
}

/** رمز QR الحالي لحاوية (للطباعة أو العرض). */
export async function binQrToken(companyId: string, binId: string): Promise<string> {
  const row = await one<{ public_id: string; nonce: string }>(
    `SELECT b.public_id, q.nonce
       FROM bins b JOIN qr_tokens q ON q.bin_id = b.id AND q.is_active
      WHERE b.id = $1 AND b.company_id = $2`,
    [binId, companyId],
  );
  if (!row) throw notFound('لا يوجد رمز QR فعّال لهذه الحاوية');
  return buildQrToken(row.public_id, row.nonce);
}
