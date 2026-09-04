import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { audit } from '../../core/audit.js';
import type { Ctx, DeviceActor } from '../../core/context.js';
import { AppError, notFound } from '../../core/errors.js';
import { isValidLatLon } from '../../core/geo.js';
import { parseQrToken } from '../../core/qr-token.js';
import { serviceDay } from '../../core/time.js';
import { one, rows, withTransaction, type Tx } from '../../db/pool.js';

export type ScanStatus = 'VERIFIED' | 'SUSPICIOUS' | 'INVALID';

/** أسباب الاشتباه/الرفض — ثابتة ليمكن ترجمتها وتصفيتها في الواجهة. */
export const REASONS = {
  TOKEN_MALFORMED: 'TOKEN_MALFORMED',
  TOKEN_BAD_SIGNATURE: 'TOKEN_BAD_SIGNATURE',
  BIN_NOT_FOUND: 'BIN_NOT_FOUND',
  BIN_DISABLED: 'BIN_DISABLED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  LOW_GPS_ACCURACY: 'LOW_GPS_ACCURACY',
  IMPLAUSIBLE_SPEED: 'IMPLAUSIBLE_SPEED',
  ROUTE_MISMATCH: 'ROUTE_MISMATCH',
  FUTURE_TIMESTAMP: 'FUTURE_TIMESTAMP',
  STALE_TIMESTAMP: 'STALE_TIMESTAMP',
  INVALID_LOCATION: 'INVALID_LOCATION',
} as const;

export type ScanReason = (typeof REASONS)[keyof typeof REASONS];

export interface ScanInput {
  clientUuid: string;
  token: string;
  lat: number;
  lon: number;
  accuracyM?: number | null;
  scannedAt: string;
  offline?: boolean;
  sessionId?: string | null;
}

export type ScanOutcome = 'accepted' | 'duplicate' | 'rejected';

export interface ScanResult {
  outcome: ScanOutcome;
  clientUuid: string;
  scanId: string | null;
  status: ScanStatus;
  counted: boolean;
  distanceM: number | null;
  radiusM: number | null;
  serviceDay: string | null;
  reasons: ScanReason[];
  bin: { id: string; publicId: string; name: string | null } | null;
  message: string;
}

interface BinLookupRow {
  id: string;
  public_id: string;
  name: string | null;
  status: 'ACTIVE' | 'DISABLED';
  gps_radius_m: number;
  distance_m: number;
}

const COMPANY_LOCK_KEY = 940_101; // مفتاح ثابت لقفل بناء سلسلة الإثبات

/**
 * أقل إزاحة (بالأمتار) قبل تفعيل فحص السرعة غير المنطقية.
 * دونها يكون الفارق ضجيج GPS لا انتقالًا فعليًا.
 */
const MIN_DISPLACEMENT_FOR_SPEED_M = 60;

function computeProofHash(parts: {
  prevHash: string | null;
  binId: string;
  nonce: string;
  lat: number;
  lon: number;
  scannedAt: string;
  workerId: string;
  vehicleId: string;
  deviceId: string;
  clientUuid: string;
}): string {
  const payload = [
    parts.prevHash ?? 'GENESIS',
    parts.binId,
    parts.nonce,
    parts.lat.toFixed(7),
    parts.lon.toFixed(7),
    parts.scannedAt,
    parts.workerId,
    parts.vehicleId,
    parts.deviceId,
    parts.clientUuid,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

async function logAttempt(
  tx: Tx,
  companyId: string,
  data: {
    binId?: string | null;
    scanId?: string | null;
    rawToken: string;
    deviceId: string;
    workerId: string;
    vehicleId: string;
    result: string;
    reason: string | null;
    lat?: number;
    lon?: number;
    clientUuid: string;
  },
): Promise<void> {
  const hasPoint = isValidLatLon({ lat: data.lat!, lon: data.lon! });
  await tx.query(
    `INSERT INTO scan_attempts
       (company_id, bin_id, scan_id, raw_token, device_id, worker_id, vehicle_id,
        result, reason, location, client_uuid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
             CASE WHEN $12::boolean THEN ST_SetSRID(ST_MakePoint($10,$11),4326)::geography END,
             $13)`,
    [
      companyId,
      data.binId ?? null,
      data.scanId ?? null,
      data.rawToken.slice(0, 200),
      data.deviceId,
      data.workerId,
      data.vehicleId,
      data.result,
      data.reason,
      data.lon ?? 0,
      data.lat ?? 0,
      hasPoint,
      data.clientUuid,
    ],
  );
}

const rejected = (
  clientUuid: string,
  reasons: ScanReason[],
  message: string,
  bin: ScanResult['bin'] = null,
): ScanResult => ({
  outcome: 'rejected',
  clientUuid,
  scanId: null,
  status: 'INVALID',
  counted: false,
  distanceM: null,
  radiusM: null,
  serviceDay: null,
  reasons,
  bin,
  message,
});

/**
 * تسجيل زيارة. يُستخدم للمسح المباشر ولمزامنة العمليات المحفوظة أوفلاين على السواء.
 *
 * لا يرمي استثناءً للحالات الميدانية (رمز غير صالح، خارج النطاق، تكرار) — يعيد نتيجة
 * موصوفة، لأن الدفعة الواحدة في المزامنة قد تحوي عناصر ناجحة وأخرى فاشلة.
 */
export async function recordScan(
  device: DeviceActor,
  timezone: string,
  input: ScanInput,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<ScanResult> {
  const scannedAt = new Date(input.scannedAt);
  if (Number.isNaN(scannedAt.getTime())) {
    return rejected(input.clientUuid, [], 'وقت المسح غير صالح');
  }
  if (!isValidLatLon({ lat: input.lat, lon: input.lon })) {
    return rejected(input.clientUuid, [REASONS.INVALID_LOCATION], 'إحداثيات المسح غير صالحة');
  }

  const parsed = parseQrToken(input.token);
  if (!parsed.ok) {
    const reason: ScanReason =
      parsed.reason === 'BAD_SIGNATURE' ? REASONS.TOKEN_BAD_SIGNATURE : REASONS.TOKEN_MALFORMED;
    await withTransaction((tx) =>
      logAttempt(tx, device.companyId, {
        rawToken: input.token,
        deviceId: device.id,
        workerId: device.workerId,
        vehicleId: device.vehicleId,
        result: 'INVALID',
        reason,
        lat: input.lat,
        lon: input.lon,
        clientUuid: input.clientUuid,
      }),
    );
    return rejected(
      input.clientUuid,
      [reason],
      parsed.reason === 'BAD_SIGNATURE'
        ? 'رمز QR غير صادر عن هذا النظام'
        : 'رمز QR غير مقروء',
    );
  }

  const { publicId, nonce } = parsed.value;

  return withTransaction(async (tx) => {
    // تسلسل بناء سلسلة الإثبات وفحص التكرار اليومي داخل الشركة الواحدة
    await tx.query('SELECT pg_advisory_xact_lock($1, $2)', [
      COMPANY_LOCK_KEY,
      hashToInt(device.companyId),
    ]);

    // 1) Idempotency: نفس clientUuid = نفس العملية
    const existing = await tx.one<{
      id: string;
      status: ScanStatus;
      counted: boolean;
      distance_m: number;
      radius_m: number;
      service_day: string;
      reasons: string[];
      bin_id: string;
      public_id: string;
      name: string | null;
    }>(
      `SELECT s.id, s.status, s.counted, s.distance_m, s.radius_m, s.service_day, s.reasons,
              s.bin_id, b.public_id, b.name
         FROM scans s JOIN bins b ON b.id = s.bin_id
        WHERE s.client_uuid = $1`,
      [input.clientUuid],
    );
    if (existing) {
      return {
        outcome: 'duplicate' as const,
        clientUuid: input.clientUuid,
        scanId: existing.id,
        status: existing.status,
        counted: existing.counted,
        distanceM: existing.distance_m,
        radiusM: existing.radius_m,
        serviceDay: existing.service_day,
        reasons: existing.reasons as ScanReason[],
        bin: { id: existing.bin_id, publicId: existing.public_id, name: existing.name },
        message: 'سبق تسجيل هذه العملية',
      };
    }

    // 2) الحاوية + التحقق من أن النونس يخص رمزها الفعّال
    const bin = await tx.one<BinLookupRow>(
      `SELECT b.id, b.public_id, b.name, b.status, b.gps_radius_m,
              ST_Distance(b.location, ST_SetSRID(ST_MakePoint($3,$4),4326)::geography) AS distance_m
         FROM bins b
         JOIN qr_tokens q ON q.bin_id = b.id AND q.is_active AND q.nonce = $5
        WHERE b.company_id = $1 AND upper(b.public_id) = upper($2)`,
      [device.companyId, publicId, input.lon, input.lat, nonce],
    );

    if (!bin) {
      // نميّز: هل الحاوية موجودة لكن الرمز مُلغى، أم غير موجودة أصلًا؟
      const exists = await tx.one<{ id: string }>(
        'SELECT id FROM bins WHERE company_id = $1 AND upper(public_id) = upper($2)',
        [device.companyId, publicId],
      );
      const reason = exists ? REASONS.TOKEN_REVOKED : REASONS.BIN_NOT_FOUND;
      await logAttempt(tx, device.companyId, {
        binId: exists?.id ?? null,
        rawToken: input.token,
        deviceId: device.id,
        workerId: device.workerId,
        vehicleId: device.vehicleId,
        result: 'INVALID',
        reason,
        lat: input.lat,
        lon: input.lon,
        clientUuid: input.clientUuid,
      });
      return rejected(
        input.clientUuid,
        [reason],
        exists ? 'رمز هذه الحاوية مُلغى — أعد طباعة الملصق' : 'الحاوية غير معروفة في النظام',
      );
    }

    if (bin.status !== 'ACTIVE') {
      await logAttempt(tx, device.companyId, {
        binId: bin.id,
        rawToken: input.token,
        deviceId: device.id,
        workerId: device.workerId,
        vehicleId: device.vehicleId,
        result: 'INVALID',
        reason: REASONS.BIN_DISABLED,
        lat: input.lat,
        lon: input.lon,
        clientUuid: input.clientUuid,
      });
      return rejected(input.clientUuid, [REASONS.BIN_DISABLED], 'الحاوية معطّلة في النظام', {
        id: bin.id,
        publicId: bin.public_id,
        name: bin.name,
      });
    }

    // 3) إشارات الاحتيال
    const reasons = await evaluateSignals(tx, device, input, scannedAt, bin);
    const status: ScanStatus = reasons.length > 0 ? 'SUSPICIOUS' : 'VERIFIED';
    const day = serviceDay(scannedAt, timezone);

    // 4) منع التكرار اليومي (تحت القفل، فالفحص ثم الإدخال آمنان)
    const countedExisting = await tx.one<{ id: string }>(
      'SELECT id FROM scans WHERE bin_id = $1 AND service_day = $2 AND counted',
      [bin.id, day],
    );
    const counted = status === 'VERIFIED' && !countedExisting;

    // 5) سلسلة الإثبات
    const last = await tx.one<{ proof_hash: string; chain_seq: number }>(
      'SELECT proof_hash, chain_seq FROM scans WHERE company_id = $1 ORDER BY chain_seq DESC LIMIT 1',
      [device.companyId],
    );
    const prevHash = last?.proof_hash ?? null;
    const chainSeq = (last?.chain_seq ?? 0) + 1;
    const proofHash = computeProofHash({
      prevHash,
      binId: bin.id,
      nonce,
      lat: input.lat,
      lon: input.lon,
      scannedAt: scannedAt.toISOString(),
      workerId: device.workerId,
      vehicleId: device.vehicleId,
      deviceId: device.id,
      clientUuid: input.clientUuid,
    });

    const inserted = await tx.one<{ id: string }>(
      `INSERT INTO scans
        (company_id, client_uuid, bin_id, qr_nonce, worker_id, vehicle_id, device_id, session_id,
         scanned_at, service_day, location, gps_accuracy_m, distance_m, radius_m,
         status, counted, duplicate_of, offline, reasons, prev_hash, proof_hash, chain_seq,
         review_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               ST_SetSRID(ST_MakePoint($11,$12),4326)::geography,
               $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [
        device.companyId,
        input.clientUuid,
        bin.id,
        nonce,
        device.workerId,
        device.vehicleId,
        device.id,
        input.sessionId ?? null,
        scannedAt,
        day,
        input.lon,
        input.lat,
        input.accuracyM ?? null,
        bin.distance_m,
        bin.gps_radius_m,
        status,
        counted,
        countedExisting?.id ?? null,
        input.offline ?? false,
        reasons,
        prevHash,
        proofHash,
        chainSeq,
        status === 'SUSPICIOUS' ? 'PENDING' : 'NONE',
      ],
    );
    if (!inserted) throw new AppError('INTERNAL', 'تعذّر حفظ الزيارة');

    await logAttempt(tx, device.companyId, {
      binId: bin.id,
      scanId: inserted.id,
      rawToken: input.token,
      deviceId: device.id,
      workerId: device.workerId,
      vehicleId: device.vehicleId,
      result: countedExisting ? 'DUPLICATE' : status,
      reason: reasons[0] ?? null,
      lat: input.lat,
      lon: input.lon,
      clientUuid: input.clientUuid,
    });

    // تحديث آخر موقع للسيارة
    await tx.query(
      `UPDATE vehicles
          SET last_location = ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,
              last_seen_at = GREATEST(COALESCE(last_seen_at, to_timestamp(0)), $4),
              updated_at = now()
        WHERE id = $1`,
      [device.vehicleId, input.lon, input.lat, scannedAt],
    );

    const ctx: Ctx = { companyId: device.companyId, actor: device, meta };
    await audit(
      ctx,
      {
        action: 'scan.record',
        entity: 'scan',
        entityId: inserted.id,
        after: {
          binPublicId: bin.public_id,
          status,
          counted,
          distanceM: Math.round(bin.distance_m * 10) / 10,
          reasons,
        },
      },
      tx,
    );

    return {
      outcome: countedExisting ? ('duplicate' as const) : ('accepted' as const),
      clientUuid: input.clientUuid,
      scanId: inserted.id,
      status,
      counted,
      distanceM: Math.round(bin.distance_m * 10) / 10,
      radiusM: bin.gps_radius_m,
      serviceDay: day,
      reasons,
      bin: { id: bin.id, publicId: bin.public_id, name: bin.name },
      message: countedExisting
        ? 'هذه الحاوية مسجّلة اليوم مسبقًا — تم حفظ المحاولة للمراجعة'
        : status === 'VERIFIED'
          ? 'تم إثبات الزيارة'
          : 'تم الحفظ وسيراجعها المسؤول',
    };
  });
}

/** تجزئة نصية إلى عدد صحيح 32-بت لاستخدامه كمفتاح قفل استشاري. */
function hashToInt(s: string): number {
  const h = createHash('sha256').update(s).digest();
  return h.readInt32BE(0);
}

async function evaluateSignals(
  tx: Tx,
  device: DeviceActor,
  input: ScanInput,
  scannedAt: Date,
  bin: BinLookupRow,
): Promise<ScanReason[]> {
  const reasons: ScanReason[] = [];
  const now = Date.now();

  if (bin.distance_m > bin.gps_radius_m) reasons.push(REASONS.OUT_OF_RANGE);

  if (
    input.accuracyM !== null &&
    input.accuracyM !== undefined &&
    input.accuracyM > env.maxGpsAccuracyM
  ) {
    reasons.push(REASONS.LOW_GPS_ACCURACY);
  }

  if (scannedAt.getTime() > now + 5 * 60_000) reasons.push(REASONS.FUTURE_TIMESTAMP);
  if (now - scannedAt.getTime() > env.maxScanClockSkewSec * 1000) {
    reasons.push(REASONS.STALE_TIMESTAMP);
  }

  // سرعة انتقال غير منطقية مقارنة بآخر مسح لنفس الجهاز
  const prev = await tx.one<{ scanned_at: Date; dist: number }>(
    `SELECT s.scanned_at,
            ST_Distance(s.location, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography) AS dist
       FROM scans s
      WHERE s.device_id = $1 AND s.scanned_at < $4
      ORDER BY s.scanned_at DESC LIMIT 1`,
    [device.id, input.lon, input.lat, scannedAt],
  );
  if (prev) {
    const dtSec = (scannedAt.getTime() - prev.scanned_at.getTime()) / 1000;
    // الحد الأدنى للإزاحة يمنع إنذارًا كاذبًا من اهتزاز GPS أو إعادة مسح في نفس الموقع:
    // حاويتان متجاورتان تُمسحان خلال ثوانٍ ليستا تلاعبًا.
    if (dtSec > 0 && prev.dist >= MIN_DISPLACEMENT_FOR_SPEED_M) {
      if (prev.dist / dtSec > env.maxPlausibleSpeedMps) {
        reasons.push(REASONS.IMPLAUSIBLE_SPEED);
      }
    }
  }

  // تعارض مع مسار السيارة المسجَّل في الجلسة نفسها
  if (input.sessionId) {
    const near = await tx.one<{ min_dist: number | null }>(
      `SELECT MIN(ST_Distance(p.location, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography)) AS min_dist
         FROM route_points p
        WHERE p.session_id = $1
          AND p.recorded_at BETWEEN $4::timestamptz - interval '15 minutes'
                                AND $4::timestamptz + interval '15 minutes'`,
      [input.sessionId, input.lon, input.lat, scannedAt],
    );
    if (near?.min_dist !== null && near?.min_dist !== undefined) {
      if (near.min_dist > env.maxRouteDeviationM) reasons.push(REASONS.ROUTE_MISMATCH);
    }
  }

  return reasons;
}

// ─────────────────────────── استعلامات الإدارة ───────────────────────────

export interface ScanListQuery {
  from?: string;
  to?: string;
  status?: ScanStatus;
  reviewStatus?: 'NONE' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  binId?: string;
  workerId?: string;
  vehicleId?: string;
  countedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ScanDto {
  id: string;
  binId: string;
  binPublicId: string;
  binName: string | null;
  workerId: string | null;
  workerName: string | null;
  vehicleId: string | null;
  vehicleNo: string | null;
  deviceId: string | null;
  scannedAt: string;
  receivedAt: string;
  serviceDay: string;
  lat: number;
  lon: number;
  accuracyM: number | null;
  distanceM: number;
  radiusM: number;
  status: ScanStatus;
  counted: boolean;
  offline: boolean;
  reasons: string[];
  reviewStatus: string;
  reviewNote: string | null;
  proofHash: string;
  prevHash: string | null;
  chainSeq: number;
}

const SCAN_SELECT = `
  SELECT s.id, s.bin_id, b.public_id AS bin_public_id, b.name AS bin_name,
         s.worker_id, w.full_name AS worker_name,
         s.vehicle_id, v.internal_no AS vehicle_no, s.device_id,
         s.scanned_at, s.received_at, s.service_day,
         ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lon,
         s.gps_accuracy_m, s.distance_m, s.radius_m, s.status, s.counted, s.offline,
         s.reasons, s.review_status, s.review_note, s.proof_hash, s.prev_hash, s.chain_seq
    FROM scans s
    JOIN bins b     ON b.id = s.bin_id
    LEFT JOIN workers w  ON w.id = s.worker_id
    LEFT JOIN vehicles v ON v.id = s.vehicle_id
`;

interface ScanRawRow {
  id: string;
  bin_id: string;
  bin_public_id: string;
  bin_name: string | null;
  worker_id: string | null;
  worker_name: string | null;
  vehicle_id: string | null;
  vehicle_no: string | null;
  device_id: string | null;
  scanned_at: Date;
  received_at: Date;
  service_day: string;
  lat: number;
  lon: number;
  gps_accuracy_m: number | null;
  distance_m: number;
  radius_m: number;
  status: ScanStatus;
  counted: boolean;
  offline: boolean;
  reasons: string[];
  review_status: string;
  review_note: string | null;
  proof_hash: string;
  prev_hash: string | null;
  chain_seq: number;
}

const toScanDto = (r: ScanRawRow): ScanDto => ({
  id: r.id,
  binId: r.bin_id,
  binPublicId: r.bin_public_id,
  binName: r.bin_name,
  workerId: r.worker_id,
  workerName: r.worker_name,
  vehicleId: r.vehicle_id,
  vehicleNo: r.vehicle_no,
  deviceId: r.device_id,
  scannedAt: r.scanned_at.toISOString(),
  receivedAt: r.received_at.toISOString(),
  serviceDay: r.service_day,
  lat: r.lat,
  lon: r.lon,
  accuracyM: r.gps_accuracy_m,
  distanceM: Math.round(r.distance_m * 10) / 10,
  radiusM: r.radius_m,
  status: r.status,
  counted: r.counted,
  offline: r.offline,
  reasons: r.reasons,
  reviewStatus: r.review_status,
  reviewNote: r.review_note,
  proofHash: r.proof_hash,
  prevHash: r.prev_hash,
  chainSeq: r.chain_seq,
});

export async function listScans(
  companyId: string,
  q: ScanListQuery,
): Promise<{ items: ScanDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, q.pageSize ?? 50));
  const where = ['s.company_id = $1'];
  const params: unknown[] = [companyId];
  let p = 1;

  if (q.from) {
    where.push(`s.service_day >= $${++p}`);
    params.push(q.from);
  }
  if (q.to) {
    where.push(`s.service_day <= $${++p}`);
    params.push(q.to);
  }
  if (q.status) {
    where.push(`s.status = $${++p}`);
    params.push(q.status);
  }
  if (q.reviewStatus) {
    where.push(`s.review_status = $${++p}`);
    params.push(q.reviewStatus);
  }
  if (q.binId) {
    where.push(`s.bin_id = $${++p}`);
    params.push(q.binId);
  }
  if (q.workerId) {
    where.push(`s.worker_id = $${++p}`);
    params.push(q.workerId);
  }
  if (q.vehicleId) {
    where.push(`s.vehicle_id = $${++p}`);
    params.push(q.vehicleId);
  }
  if (q.countedOnly) where.push('s.counted');

  const clause = `WHERE ${where.join(' AND ')}`;
  const totalRow = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM scans s ${clause}`,
    params,
  );
  const list = await rows<ScanRawRow>(
    `${SCAN_SELECT} ${clause} ORDER BY s.scanned_at DESC LIMIT ${pageSize} OFFSET ${
      (page - 1) * pageSize
    }`,
    params,
  );
  return { items: list.map(toScanDto), total: totalRow?.count ?? 0, page, pageSize };
}

export async function getScan(companyId: string, id: string): Promise<ScanDto> {
  const row = await one<ScanRawRow>(`${SCAN_SELECT} WHERE s.id = $1 AND s.company_id = $2`, [
    id,
    companyId,
  ]);
  if (!row) throw notFound('الزيارة غير موجودة');
  return toScanDto(row);
}

/**
 * مراجعة الإدارة لزيارة مشبوهة. القبول يحتسبها زيارة اليوم إن لم تكن هناك زيارة معتمدة،
 * والرفض يلغي احتسابها.
 */
export async function reviewScan(
  ctx: Ctx,
  id: string,
  input: { reviewStatus: 'ACCEPTED' | 'REJECTED'; note?: string },
): Promise<ScanDto> {
  const before = await getScan(ctx.companyId, id);

  await withTransaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1, $2)', [
      COMPANY_LOCK_KEY,
      hashToInt(ctx.companyId),
    ]);

    let counted = before.counted;
    if (input.reviewStatus === 'ACCEPTED' && !before.counted) {
      const other = await tx.one<{ id: string }>(
        'SELECT id FROM scans WHERE bin_id = $1 AND service_day = $2 AND counted AND id <> $3',
        [before.binId, before.serviceDay, id],
      );
      counted = !other;
    } else if (input.reviewStatus === 'REJECTED') {
      counted = false;
    }

    await tx.query(
      `UPDATE scans
          SET review_status = $2, review_note = $3, reviewed_at = now(), reviewed_by = $4,
              counted = $5
        WHERE id = $1 AND company_id = $6`,
      [
        id,
        input.reviewStatus,
        input.note ?? null,
        ctx.actor?.kind === 'user' ? ctx.actor.id : null,
        counted,
        ctx.companyId,
      ],
    );
  });

  const after = await getScan(ctx.companyId, id);
  await audit(ctx, {
    action: 'scan.review',
    entity: 'scan',
    entityId: id,
    before: { reviewStatus: before.reviewStatus, counted: before.counted },
    after: { reviewStatus: after.reviewStatus, counted: after.counted, note: input.note },
  });
  return after;
}

export interface ChainVerifyResult {
  ok: boolean;
  checked: number;
  brokenAt: { scanId: string; chainSeq: number; expected: string; found: string }[];
}

/**
 * التحقق من سلامة سلسلة الإثبات: يُعيد حساب كل تجزئة من محتوى السجل ويقارنها بالمخزَّن،
 * ويتأكد أن كل سجل يشير إلى تجزئة سابقه. أي تعديل يدوي على قاعدة البيانات يظهر هنا.
 */
export async function verifyChain(companyId: string, limit = 100_000): Promise<ChainVerifyResult> {
  const list = await rows<{
    id: string;
    chain_seq: number;
    prev_hash: string | null;
    proof_hash: string;
    bin_id: string;
    nonce: string | null;
    lat: number;
    lon: number;
    scanned_at: Date;
    worker_id: string | null;
    vehicle_id: string | null;
    device_id: string | null;
    client_uuid: string;
  }>(
    `SELECT s.id, s.chain_seq, s.prev_hash, s.proof_hash, s.bin_id,
            s.qr_nonce AS nonce,
            ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lon,
            s.scanned_at, s.worker_id, s.vehicle_id, s.device_id, s.client_uuid
       FROM scans s
      WHERE s.company_id = $1
      ORDER BY s.chain_seq
      LIMIT ${Math.max(1, Math.floor(limit))}`,
    [companyId],
  );

  const broken: ChainVerifyResult['brokenAt'] = [];
  let prev: string | null = null;

  for (const r of list) {
    const expected = computeProofHash({
      prevHash: prev,
      binId: r.bin_id,
      nonce: r.nonce ?? '',
      lat: r.lat,
      lon: r.lon,
      scannedAt: r.scanned_at.toISOString(),
      workerId: r.worker_id ?? '',
      vehicleId: r.vehicle_id ?? '',
      deviceId: r.device_id ?? '',
      clientUuid: r.client_uuid,
    });
    if (expected !== r.proof_hash || r.prev_hash !== prev) {
      broken.push({
        scanId: r.id,
        chainSeq: r.chain_seq,
        expected,
        found: r.proof_hash,
      });
    }
    prev = r.proof_hash;
  }

  return { ok: broken.length === 0, checked: list.length, brokenAt: broken };
}
