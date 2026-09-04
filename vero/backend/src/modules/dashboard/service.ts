import { one, rows } from '../../db/pool.js';

export interface DashboardStats {
  serviceDay: string;
  totalBins: number;
  activeBins: number;
  servicedToday: number;
  remaining: number;
  needsReview: number;
  completionRate: number;
  activeVehicles: number;
  offlineVehicles: number;
  activeSessions: number;
  offlineScansToday: number;
  suspiciousToday: number;
  invalidAttemptsToday: number;
}

export async function dashboard(companyId: string, day: string): Promise<DashboardStats> {
  const r = await one<{
    total_bins: number;
    active_bins: number;
    serviced: number;
    needs_review: number;
    suspicious: number;
    offline_scans: number;
    invalid_attempts: number;
    active_vehicles: number;
    offline_vehicles: number;
    active_sessions: number;
  }>(
    `SELECT
       (SELECT count(*)::int FROM bins WHERE company_id = $1)                                AS total_bins,
       (SELECT count(*)::int FROM bins WHERE company_id = $1 AND status = 'ACTIVE')          AS active_bins,
       (SELECT count(DISTINCT bin_id)::int FROM scans
         WHERE company_id = $1 AND service_day = $2 AND counted)                             AS serviced,
       (SELECT count(*)::int FROM scans
         WHERE company_id = $1 AND review_status = 'PENDING')                                AS needs_review,
       (SELECT count(*)::int FROM scans
         WHERE company_id = $1 AND service_day = $2 AND status = 'SUSPICIOUS')               AS suspicious,
       (SELECT count(*)::int FROM scans
         WHERE company_id = $1 AND service_day = $2 AND offline)                             AS offline_scans,
       (SELECT count(*)::int FROM scan_attempts
         WHERE company_id = $1 AND result = 'INVALID'
           AND created_at >= (now() - interval '24 hours'))                                  AS invalid_attempts,
       (SELECT count(*)::int FROM vehicles
         WHERE company_id = $1 AND status = 'ACTIVE'
           AND last_seen_at >= (now() - interval '15 minutes'))                              AS active_vehicles,
       (SELECT count(*)::int FROM vehicles
         WHERE company_id = $1 AND status = 'ACTIVE'
           AND (last_seen_at IS NULL OR last_seen_at < (now() - interval '15 minutes')))     AS offline_vehicles,
       (SELECT count(*)::int FROM route_sessions
         WHERE company_id = $1 AND ended_at IS NULL)                                         AS active_sessions
    `,
    [companyId, day],
  );

  const activeBins = r?.active_bins ?? 0;
  const serviced = r?.serviced ?? 0;
  const remaining = Math.max(0, activeBins - serviced);
  const rate = activeBins === 0 ? 0 : Math.round((serviced / activeBins) * 1000) / 10;

  return {
    serviceDay: day,
    totalBins: r?.total_bins ?? 0,
    activeBins,
    servicedToday: serviced,
    remaining,
    needsReview: r?.needs_review ?? 0,
    completionRate: rate,
    activeVehicles: r?.active_vehicles ?? 0,
    offlineVehicles: r?.offline_vehicles ?? 0,
    activeSessions: r?.active_sessions ?? 0,
    offlineScansToday: r?.offline_scans ?? 0,
    suspiciousToday: r?.suspicious ?? 0,
    invalidAttemptsToday: r?.invalid_attempts ?? 0,
  };
}

export type AttentionKind =
  | 'BIN_NOT_SERVICED'
  | 'SCAN_OUT_OF_RANGE'
  | 'SUSPICIOUS_SCAN'
  | 'VEHICLE_OFFLINE'
  | 'INVALID_TOKEN_ATTEMPT'
  | 'BIN_MISSING_QR'
  | 'BIN_DISABLED';

export type AttentionSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AttentionItem {
  kind: AttentionKind;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  entity: string;
  entityId: string;
  at: string | null;
}

/**
 * «تحتاج انتباه»: يعرض الاستثناءات فقط — لا آلاف السطور الطبيعية.
 * كل نوع محدود بعدد معقول حتى تبقى الصفحة سريعة وقابلة للتصرف.
 */
export async function attention(
  companyId: string,
  day: string,
  perKind = 50,
): Promise<{ items: AttentionItem[]; counts: Record<AttentionKind, number> }> {
  const limit = Math.min(200, Math.max(1, perKind));
  const items: AttentionItem[] = [];

  const notServiced = await rows<{ id: string; public_id: string; sector: string | null }>(
    `SELECT b.id, b.public_id, b.sector FROM bins b
      WHERE b.company_id = $1 AND b.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM scans s WHERE s.bin_id = b.id AND s.service_day = $2 AND s.counted
        )
      ORDER BY b.public_id LIMIT ${limit}`,
    [companyId, day],
  );
  for (const b of notServiced) {
    items.push({
      kind: 'BIN_NOT_SERVICED',
      severity: 'HIGH',
      title: `حاوية لم تتم خدمتها: ${b.public_id}`,
      detail: b.sector ? `القطاع: ${b.sector}` : 'بدون قطاع محدد',
      entity: 'bin',
      entityId: b.id,
      at: null,
    });
  }

  const suspicious = await rows<{
    id: string;
    public_id: string;
    distance_m: number;
    radius_m: number;
    reasons: string[];
    scanned_at: Date;
  }>(
    `SELECT s.id, b.public_id, s.distance_m, s.radius_m, s.reasons, s.scanned_at
       FROM scans s JOIN bins b ON b.id = s.bin_id
      WHERE s.company_id = $1 AND s.review_status = 'PENDING'
      ORDER BY s.scanned_at DESC LIMIT ${limit}`,
    [companyId],
  );
  for (const s of suspicious) {
    const outOfRange = s.reasons.includes('OUT_OF_RANGE');
    items.push({
      kind: outOfRange ? 'SCAN_OUT_OF_RANGE' : 'SUSPICIOUS_SCAN',
      severity: 'HIGH',
      title: outOfRange
        ? `مسح خارج النطاق: ${s.public_id}`
        : `زيارة تحتاج مراجعة: ${s.public_id}`,
      detail: outOfRange
        ? `المسافة ${Math.round(s.distance_m)}م والنطاق المسموح ${s.radius_m}م`
        : `الأسباب: ${s.reasons.join(', ')}`,
      entity: 'scan',
      entityId: s.id,
      at: s.scanned_at.toISOString(),
    });
  }

  const offlineVehicles = await rows<{
    id: string;
    internal_no: string;
    last_seen_at: Date | null;
  }>(
    `SELECT id, internal_no, last_seen_at FROM vehicles
      WHERE company_id = $1 AND status = 'ACTIVE'
        AND (last_seen_at IS NULL OR last_seen_at < (now() - interval '15 minutes'))
      ORDER BY last_seen_at NULLS FIRST LIMIT ${limit}`,
    [companyId],
  );
  for (const v of offlineVehicles) {
    items.push({
      kind: 'VEHICLE_OFFLINE',
      severity: 'MEDIUM',
      title: `سيارة غير متصلة: ${v.internal_no}`,
      detail: v.last_seen_at
        ? `آخر اتصال: ${v.last_seen_at.toISOString()}`
        : 'لم تتصل بالنظام بعد',
      entity: 'vehicle',
      entityId: v.id,
      at: v.last_seen_at ? v.last_seen_at.toISOString() : null,
    });
  }

  const badAttempts = await rows<{
    id: string;
    raw_token: string | null;
    reason: string | null;
    created_at: Date;
  }>(
    `SELECT id, raw_token, reason, created_at FROM scan_attempts
      WHERE company_id = $1 AND result = 'INVALID'
        AND reason IN ('TOKEN_BAD_SIGNATURE','TOKEN_MALFORMED','TOKEN_REVOKED')
        AND created_at >= (now() - interval '48 hours')
      ORDER BY created_at DESC LIMIT ${limit}`,
    [companyId],
  );
  for (const a of badAttempts) {
    items.push({
      kind: 'INVALID_TOKEN_ATTEMPT',
      severity: 'MEDIUM',
      title: 'محاولة مسح برمز غير صالح',
      detail: `السبب: ${a.reason ?? 'غير محدد'}`,
      entity: 'scan_attempt',
      entityId: a.id,
      at: a.created_at.toISOString(),
    });
  }

  const missingQr = await rows<{ id: string; public_id: string }>(
    `SELECT b.id, b.public_id FROM bins b
      WHERE b.company_id = $1
        AND NOT EXISTS (SELECT 1 FROM qr_tokens q WHERE q.bin_id = b.id AND q.is_active)
      LIMIT ${limit}`,
    [companyId],
  );
  for (const b of missingQr) {
    items.push({
      kind: 'BIN_MISSING_QR',
      severity: 'HIGH',
      title: `حاوية بلا رمز QR فعّال: ${b.public_id}`,
      detail: 'أعد توليد الرمز من مركز QR',
      entity: 'bin',
      entityId: b.id,
      at: null,
    });
  }

  const disabled = await rows<{ id: string; public_id: string }>(
    `SELECT id, public_id FROM bins WHERE company_id = $1 AND status = 'DISABLED' LIMIT ${limit}`,
    [companyId],
  );
  for (const b of disabled) {
    items.push({
      kind: 'BIN_DISABLED',
      severity: 'LOW',
      title: `حاوية معطّلة: ${b.public_id}`,
      detail: 'لن تُحتسب ضمن نسبة الإنجاز',
      entity: 'bin',
      entityId: b.id,
      at: null,
    });
  }

  const counts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.kind] = (acc[i.kind] ?? 0) + 1;
    return acc;
  }, {});

  const order: Record<AttentionSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  return { items, counts: counts as Record<AttentionKind, number> };
}
