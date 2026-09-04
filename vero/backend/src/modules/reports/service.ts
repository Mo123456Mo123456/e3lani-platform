import { audit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import { randomToken } from '../../core/crypto.js';
import { AppError, notFound } from '../../core/errors.js';
import { daysBetweenInclusive, isIsoDay } from '../../core/time.js';
import { one, rows, withTransaction } from '../../db/pool.js';
import { requireCompany } from '../company/service.js';

export type ReportKind = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface SlaContract {
  id: string;
  name: string;
  clientName: string | null;
  requiredVisitsPerDay: number;
  scopeSector: string | null;
  expectedPoints: number | null;
  activeFrom: string;
  activeTo: string | null;
  isActive: boolean;
}

export interface DimensionRow {
  key: string;
  label: string;
  required: number;
  verified: number;
  suspicious: number;
  invalid: number;
  missed: number;
  ratio: number;
}

export interface ReportPayload {
  reportNo: string;
  kind: ReportKind;
  periodStart: string;
  periodEnd: string;
  days: number;
  issuedAt: string;
  company: { name: string; city: string | null; phone: string | null; email: string | null };
  sla: {
    contractName: string | null;
    requiredVisitsPerDay: number;
    servicePoints: number;
    requiredVisits: number;
    verified: number;
    suspicious: number;
    invalidAttempts: number;
    missed: number;
    complianceRate: number;
  };
  byVehicle: DimensionRow[];
  byWorker: DimensionRow[];
  bySector: DimensionRow[];
  byDay: DimensionRow[];
  exceptions: {
    binsNeverServiced: { publicId: string; sector: string | null; name: string | null }[];
    suspiciousScans: {
      binPublicId: string;
      scannedAt: string;
      distanceM: number;
      radiusM: number;
      reasons: string[];
      workerName: string | null;
    }[];
  };
  routes: {
    sessions: number;
    totalDistanceKm: number;
    vehiclesActive: number;
  };
}

export interface ReportDto {
  id: string;
  reportNo: string;
  kind: ReportKind;
  periodStart: string;
  periodEnd: string;
  verifyToken: string;
  createdAt: string;
  createdByName: string | null;
  payload: ReportPayload;
}

// ─────────────────────────── عقود SLA ───────────────────────────

const toSla = (r: {
  id: string;
  name: string;
  client_name: string | null;
  required_visits_per_day: number;
  scope_sector: string | null;
  expected_points: number | null;
  active_from: string;
  active_to: string | null;
  is_active: boolean;
}): SlaContract => ({
  id: r.id,
  name: r.name,
  clientName: r.client_name,
  requiredVisitsPerDay: r.required_visits_per_day,
  scopeSector: r.scope_sector,
  expectedPoints: r.expected_points,
  activeFrom: r.active_from,
  activeTo: r.active_to,
  isActive: r.is_active,
});

export async function listSlaContracts(companyId: string): Promise<SlaContract[]> {
  const list = await rows<Parameters<typeof toSla>[0]>(
    'SELECT * FROM sla_contracts WHERE company_id = $1 ORDER BY created_at DESC',
    [companyId],
  );
  return list.map(toSla);
}

export interface SlaInput {
  name: string;
  clientName?: string | null;
  requiredVisitsPerDay: number;
  scopeSector?: string | null;
  expectedPoints?: number | null;
  activeFrom: string;
  activeTo?: string | null;
}

export async function createSlaContract(ctx: Ctx, input: SlaInput): Promise<SlaContract> {
  const row = await one<Parameters<typeof toSla>[0]>(
    `INSERT INTO sla_contracts
       (company_id, name, client_name, required_visits_per_day, scope_sector,
        expected_points, active_from, active_to)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      ctx.companyId,
      input.name,
      input.clientName ?? null,
      input.requiredVisitsPerDay,
      input.scopeSector ?? null,
      input.expectedPoints ?? null,
      input.activeFrom,
      input.activeTo ?? null,
    ],
  );
  if (!row) throw new AppError('INTERNAL', 'تعذّر إنشاء عقد SLA');
  await audit(ctx, {
    action: 'sla.create',
    entity: 'sla_contract',
    entityId: row.id,
    after: toSla(row),
  });
  return toSla(row);
}

// ─────────────────────────── حساب التقرير ───────────────────────────

const pct = (num: number, den: number): number =>
  den <= 0 ? 0 : Math.round((num / den) * 10000) / 100;

/**
 * يحسب التقرير من قاعدة البيانات مباشرة.
 *
 * الأساس: **الزيارات المطلوبة = نقاط الخدمة الفعّالة × الزيارات اليومية المطلوبة × عدد الأيام**،
 * و«المنفَّذ» = الزيارات المعتمدة (`counted`) داخل الفترة. الفارق هو غير المنفَّذ.
 */
export async function computeReport(
  companyId: string,
  input: { kind: ReportKind; from: string; to: string; slaContractId?: string | null },
): Promise<ReportPayload> {
  if (!isIsoDay(input.from) || !isIsoDay(input.to)) {
    throw new AppError('VALIDATION_FAILED', 'صيغة التاريخ يجب أن تكون YYYY-MM-DD');
  }
  if (input.to < input.from) {
    throw new AppError('VALIDATION_FAILED', 'تاريخ النهاية قبل تاريخ البداية');
  }
  const company = await requireCompany();
  const days = daysBetweenInclusive(input.from, input.to);

  let sla: SlaContract | null = null;
  if (input.slaContractId) {
    const row = await one<Parameters<typeof toSla>[0]>(
      'SELECT * FROM sla_contracts WHERE id = $1 AND company_id = $2',
      [input.slaContractId, companyId],
    );
    if (!row) throw notFound('عقد SLA غير موجود');
    sla = toSla(row);
  }

  const sectorFilter = sla?.scopeSector ?? null;

  const pointsRow = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM bins
      WHERE company_id = $1 AND status = 'ACTIVE'
        AND ($2::text IS NULL OR sector = $2)`,
    [companyId, sectorFilter],
  );
  const servicePoints = sla?.expectedPoints ?? pointsRow?.count ?? 0;
  const perDay = sla?.requiredVisitsPerDay ?? 1;
  const requiredVisits = servicePoints * perDay * days;

  const totals = await one<{ verified: number; suspicious: number; counted: number }>(
    `SELECT
       count(*) FILTER (WHERE s.status = 'VERIFIED')::int   AS verified,
       count(*) FILTER (WHERE s.status = 'SUSPICIOUS')::int AS suspicious,
       count(*) FILTER (WHERE s.counted)::int               AS counted
     FROM scans s JOIN bins b ON b.id = s.bin_id
     WHERE s.company_id = $1 AND s.service_day BETWEEN $2 AND $3
       AND ($4::text IS NULL OR b.sector = $4)`,
    [companyId, input.from, input.to, sectorFilter],
  );

  const invalidRow = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM scan_attempts
      WHERE company_id = $1 AND result = 'INVALID'
        AND created_at::date BETWEEN $2::date AND $3::date`,
    [companyId, input.from, input.to],
  );

  const executed = totals?.counted ?? 0;
  const missed = Math.max(0, requiredVisits - executed);

  const byVehicle = await dimension(
    companyId,
    input,
    sectorFilter,
    'v.internal_no',
    "COALESCE(v.name, v.internal_no)",
    'LEFT JOIN vehicles v ON v.id = s.vehicle_id',
  );
  const byWorker = await dimension(
    companyId,
    input,
    sectorFilter,
    'w.employee_no',
    'w.full_name',
    'LEFT JOIN workers w ON w.id = s.worker_id',
  );
  const bySector = await dimension(companyId, input, sectorFilter, 'b.sector', 'b.sector', '');
  const byDay = await dimension(
    companyId,
    input,
    sectorFilter,
    's.service_day::text',
    's.service_day::text',
    '',
  );

  // توزيع المطلوب على الأيام (لكل يوم نفس عدد النقاط المطلوبة)
  const dailyRequired = servicePoints * perDay;
  for (const d of byDay) {
    d.required = dailyRequired;
    d.missed = Math.max(0, dailyRequired - d.verified);
    d.ratio = pct(d.verified, dailyRequired);
  }

  const neverServiced = await rows<{
    public_id: string;
    sector: string | null;
    name: string | null;
  }>(
    `SELECT b.public_id, b.sector, b.name FROM bins b
      WHERE b.company_id = $1 AND b.status = 'ACTIVE'
        AND ($4::text IS NULL OR b.sector = $4)
        AND NOT EXISTS (
          SELECT 1 FROM scans s
           WHERE s.bin_id = b.id AND s.service_day BETWEEN $2 AND $3 AND s.counted
        )
      ORDER BY b.public_id LIMIT 500`,
    [companyId, input.from, input.to, sectorFilter],
  );

  const suspiciousScans = await rows<{
    bin_public_id: string;
    scanned_at: Date;
    distance_m: number;
    radius_m: number;
    reasons: string[];
    worker_name: string | null;
  }>(
    `SELECT b.public_id AS bin_public_id, s.scanned_at, s.distance_m, s.radius_m, s.reasons,
            w.full_name AS worker_name
       FROM scans s
       JOIN bins b ON b.id = s.bin_id
       LEFT JOIN workers w ON w.id = s.worker_id
      WHERE s.company_id = $1 AND s.service_day BETWEEN $2 AND $3
        AND s.status = 'SUSPICIOUS'
        AND ($4::text IS NULL OR b.sector = $4)
      ORDER BY s.scanned_at DESC LIMIT 500`,
    [companyId, input.from, input.to, sectorFilter],
  );

  const routeAgg = await one<{ sessions: number; dist: number; vehicles: number }>(
    `SELECT count(*)::int AS sessions,
            COALESCE(SUM(distance_m),0) AS dist,
            count(DISTINCT vehicle_id)::int AS vehicles
       FROM route_sessions
      WHERE company_id = $1 AND service_day BETWEEN $2 AND $3`,
    [companyId, input.from, input.to],
  );

  return {
    reportNo: '',
    kind: input.kind,
    periodStart: input.from,
    periodEnd: input.to,
    days,
    issuedAt: new Date().toISOString(),
    company: {
      name: company.name,
      city: company.city,
      phone: company.phone,
      email: company.email,
    },
    sla: {
      contractName: sla?.name ?? null,
      requiredVisitsPerDay: perDay,
      servicePoints,
      requiredVisits,
      verified: totals?.verified ?? 0,
      suspicious: totals?.suspicious ?? 0,
      invalidAttempts: invalidRow?.count ?? 0,
      missed,
      complianceRate: pct(executed, requiredVisits),
    },
    byVehicle,
    byWorker,
    bySector,
    byDay,
    exceptions: {
      binsNeverServiced: neverServiced.map((b) => ({
        publicId: b.public_id,
        sector: b.sector,
        name: b.name,
      })),
      suspiciousScans: suspiciousScans.map((s) => ({
        binPublicId: s.bin_public_id,
        scannedAt: s.scanned_at.toISOString(),
        distanceM: Math.round(s.distance_m),
        radiusM: s.radius_m,
        reasons: s.reasons,
        workerName: s.worker_name,
      })),
    },
    routes: {
      sessions: routeAgg?.sessions ?? 0,
      totalDistanceKm: Math.round((routeAgg?.dist ?? 0) / 100) / 10,
      vehiclesActive: routeAgg?.vehicles ?? 0,
    },
  };
}

async function dimension(
  companyId: string,
  input: { from: string; to: string },
  sectorFilter: string | null,
  keyExpr: string,
  labelExpr: string,
  join: string,
): Promise<DimensionRow[]> {
  const list = await rows<{
    key: string | null;
    label: string | null;
    verified: number;
    suspicious: number;
    counted: number;
  }>(
    `SELECT ${keyExpr} AS key, ${labelExpr} AS label,
            count(*) FILTER (WHERE s.status = 'VERIFIED')::int   AS verified,
            count(*) FILTER (WHERE s.status = 'SUSPICIOUS')::int AS suspicious,
            count(*) FILTER (WHERE s.counted)::int               AS counted
       FROM scans s
       JOIN bins b ON b.id = s.bin_id
       ${join}
      WHERE s.company_id = $1 AND s.service_day BETWEEN $2 AND $3
        AND ($4::text IS NULL OR b.sector = $4)
      GROUP BY 1, 2
      ORDER BY 1`,
    [companyId, input.from, input.to, sectorFilter],
  );

  return list
    .filter((r) => r.key !== null)
    .map((r) => {
      const total = r.verified + r.suspicious;
      return {
        key: String(r.key),
        label: r.label ?? String(r.key),
        required: 0,
        verified: r.verified,
        suspicious: r.suspicious,
        invalid: 0,
        missed: 0,
        ratio: pct(r.verified, total),
      };
    });
}

// ─────────────────────────── حفظ التقرير ───────────────────────────

export async function createReport(
  ctx: Ctx,
  input: { kind: ReportKind; from: string; to: string; slaContractId?: string | null },
): Promise<ReportDto> {
  const payload = await computeReport(ctx.companyId, input);

  const saved = await withTransaction(async (tx) => {
    const seq = await tx.one<{ n: number }>("SELECT nextval('report_no_seq')::int AS n");
    const reportNo = `VR-R-${new Date().getFullYear()}-${String(seq!.n).padStart(5, '0')}`;
    payload.reportNo = reportNo;
    const verifyToken = randomToken(16);

    const row = await tx.one<{ id: string; created_at: Date }>(
      `INSERT INTO reports
         (company_id, report_no, kind, period_start, period_end, sla_contract_id,
          verify_token, payload, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
      [
        ctx.companyId,
        reportNo,
        input.kind,
        input.from,
        input.to,
        input.slaContractId ?? null,
        verifyToken,
        JSON.stringify(payload),
        ctx.actor?.kind === 'user' ? ctx.actor.id : null,
      ],
    );
    if (!row) throw new AppError('INTERNAL', 'تعذّر حفظ التقرير');

    const dims: [string, DimensionRow[]][] = [
      ['VEHICLE', payload.byVehicle],
      ['WORKER', payload.byWorker],
      ['SECTOR', payload.bySector],
      ['DAY', payload.byDay],
    ];
    for (const [dim, items] of dims) {
      for (const it of items) {
        await tx.query(
          `INSERT INTO report_items
             (report_id, dimension, key, label, required, verified, suspicious, invalid, missed, ratio)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            row.id,
            dim,
            it.key,
            it.label,
            it.required,
            it.verified,
            it.suspicious,
            it.invalid,
            it.missed,
            it.ratio,
          ],
        );
      }
    }
    return { id: row.id, createdAt: row.created_at, reportNo, verifyToken };
  });

  await audit(ctx, {
    action: 'report.create',
    entity: 'report',
    entityId: saved.id,
    after: {
      reportNo: saved.reportNo,
      kind: input.kind,
      period: `${input.from} → ${input.to}`,
      complianceRate: payload.sla.complianceRate,
    },
  });

  return {
    id: saved.id,
    reportNo: saved.reportNo,
    kind: input.kind,
    periodStart: input.from,
    periodEnd: input.to,
    verifyToken: saved.verifyToken,
    createdAt: saved.createdAt.toISOString(),
    createdByName: ctx.actor?.kind === 'user' ? ctx.actor.fullName : null,
    payload,
  };
}

interface ReportRow {
  id: string;
  report_no: string;
  kind: ReportKind;
  period_start: string;
  period_end: string;
  verify_token: string;
  payload: ReportPayload;
  created_at: Date;
  created_by_name: string | null;
}

const toReportDto = (r: ReportRow): ReportDto => ({
  id: r.id,
  reportNo: r.report_no,
  kind: r.kind,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  verifyToken: r.verify_token,
  createdAt: r.created_at.toISOString(),
  createdByName: r.created_by_name,
  payload: r.payload,
});

const REPORT_SELECT = `
  SELECT r.id, r.report_no, r.kind, r.period_start, r.period_end, r.verify_token,
         r.payload, r.created_at, u.full_name AS created_by_name
    FROM reports r LEFT JOIN users u ON u.id = r.created_by
`;

export async function listReports(companyId: string, limit = 100): Promise<ReportDto[]> {
  const list = await rows<ReportRow>(
    `${REPORT_SELECT} WHERE r.company_id = $1 ORDER BY r.created_at DESC LIMIT ${Math.min(
      500,
      limit,
    )}`,
    [companyId],
  );
  return list.map(toReportDto);
}

export async function getReport(companyId: string, id: string): Promise<ReportDto> {
  const row = await one<ReportRow>(`${REPORT_SELECT} WHERE r.id = $1 AND r.company_id = $2`, [
    id,
    companyId,
  ]);
  if (!row) throw notFound('التقرير غير موجود');
  return toReportDto(row);
}

export interface PublicVerification {
  reportNo: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  complianceRate: number;
  issuedAt: string;
  status: 'Verified Report';
}

/**
 * تحقق عام من التقرير عبر رمز التقرير. لا يعرض أي بيانات تشغيلية حساسة:
 * لا حاويات، لا عمال، لا إحداثيات.
 */
export async function verifyReport(token: string): Promise<PublicVerification> {
  const row = await one<{
    report_no: string;
    period_start: string;
    period_end: string;
    payload: ReportPayload;
    created_at: Date;
    company_name: string;
  }>(
    `SELECT r.report_no, r.period_start, r.period_end, r.payload, r.created_at, c.name AS company_name
       FROM reports r JOIN companies c ON c.id = r.company_id
      WHERE r.verify_token = $1`,
    [token],
  );
  if (!row) throw notFound('لا يوجد تقرير بهذا الرمز');
  return {
    reportNo: row.report_no,
    companyName: row.company_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    complianceRate: row.payload.sla.complianceRate,
    issuedAt: row.created_at.toISOString(),
    status: 'Verified Report',
  };
}
