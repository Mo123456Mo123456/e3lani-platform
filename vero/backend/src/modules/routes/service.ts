import type { DeviceActor } from '../../core/context.js';
import { AppError, notFound } from '../../core/errors.js';
import { isValidLatLon } from '../../core/geo.js';
import { serviceDay } from '../../core/time.js';
import { one, rows, withTransaction } from '../../db/pool.js';

export interface RoutePointInput {
  clientUuid: string;
  lat: number;
  lon: number;
  recordedAt: string;
  speedMps?: number | null;
  accuracyM?: number | null;
}

export interface SessionDto {
  id: string;
  workerId: string;
  workerName: string | null;
  vehicleId: string;
  vehicleNo: string | null;
  startedAt: string;
  endedAt: string | null;
  serviceDay: string;
  pointsCount: number;
  distanceM: number;
  scansCount?: number;
}

/** بدء جلسة عمل. التتبع يبدأ هنا وينتهي بإغلاق الجلسة — لا تتبّع خارجها. */
export async function startSession(
  device: DeviceActor,
  timezone: string,
  startedAt?: string,
): Promise<{ sessionId: string; serviceDay: string }> {
  const at = startedAt ? new Date(startedAt) : new Date();
  if (Number.isNaN(at.getTime())) throw new AppError('VALIDATION_FAILED', 'وقت البدء غير صالح');
  const day = serviceDay(at, timezone);

  return withTransaction(async (tx) => {
    // إغلاق أي جلسة مفتوحة قديمة لنفس الجهاز حتى لا تتراكم
    await tx.query(
      'UPDATE route_sessions SET ended_at = now() WHERE device_id = $1 AND ended_at IS NULL',
      [device.id],
    );
    const row = await tx.one<{ id: string }>(
      `INSERT INTO route_sessions
         (company_id, worker_id, vehicle_id, device_id, started_at, service_day)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [device.companyId, device.workerId, device.vehicleId, device.id, at, day],
    );
    if (!row) throw new AppError('INTERNAL', 'تعذّر بدء جلسة العمل');
    return { sessionId: row.id, serviceDay: day };
  });
}

export async function endSession(device: DeviceActor, sessionId: string): Promise<void> {
  const res = await one<{ id: string }>(
    `UPDATE route_sessions SET ended_at = now()
      WHERE id = $1 AND device_id = $2 AND ended_at IS NULL RETURNING id`,
    [sessionId, device.id],
  );
  if (!res) throw notFound('الجلسة غير موجودة أو مغلقة مسبقًا');
}

export async function currentSession(device: DeviceActor): Promise<SessionDto | null> {
  const row = await one<SessionRow>(
    `${SESSION_SELECT} WHERE rs.device_id = $1 AND rs.ended_at IS NULL
      ORDER BY rs.started_at DESC LIMIT 1`,
    [device.id],
  );
  return row ? toSessionDto(row) : null;
}

export interface AddPointsResult {
  accepted: number;
  duplicates: number;
  rejected: number;
  pointsCount: number;
  distanceM: number;
}

/**
 * إضافة نقاط المسار. مقاوم لإعادة الإرسال: `client_uuid` فريد،
 * وأي نقطة مكرَّرة تُحسب `duplicate` بلا خطأ.
 */
export async function addRoutePoints(
  device: DeviceActor,
  sessionId: string,
  points: RoutePointInput[],
): Promise<AddPointsResult> {
  const session = await one<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM route_sessions WHERE id = $1 AND device_id = $2',
    [sessionId, device.id],
  );
  if (!session) throw notFound('الجلسة غير موجودة لهذا الجهاز');

  let accepted = 0;
  let duplicates = 0;
  let rejectedCount = 0;

  await withTransaction(async (tx) => {
    for (const p of points) {
      if (!isValidLatLon({ lat: p.lat, lon: p.lon })) {
        rejectedCount++;
        continue;
      }
      const at = new Date(p.recordedAt);
      if (Number.isNaN(at.getTime())) {
        rejectedCount++;
        continue;
      }
      const r = await tx.one<{ id: string }>(
        `INSERT INTO route_points
           (company_id, session_id, client_uuid, recorded_at, location, speed_mps, accuracy_m)
         VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6),4326)::geography, $7,$8)
         ON CONFLICT (client_uuid) DO NOTHING
         RETURNING id`,
        [
          device.companyId,
          sessionId,
          p.clientUuid,
          at,
          p.lon,
          p.lat,
          p.speedMps ?? null,
          p.accuracyM ?? null,
        ],
      );
      if (r) accepted++;
      else duplicates++;
    }

    // إعادة حساب العدّاد والمسافة من النقاط الفعلية (مصدر الحقيقة واحد)
    await tx.query(
      `UPDATE route_sessions rs
          SET points_count = agg.cnt,
              distance_m   = COALESCE(agg.dist, 0)
         FROM (
           SELECT count(*)::int AS cnt,
                  ST_Length(ST_MakeLine(p.location::geometry ORDER BY p.recorded_at)::geography) AS dist
             FROM route_points p WHERE p.session_id = $1
         ) agg
        WHERE rs.id = $1`,
      [sessionId],
    );

    // آخر موقع للسيارة = أحدث نقطة
    await tx.query(
      `UPDATE vehicles v
          SET last_location = p.location,
              last_seen_at  = p.recorded_at,
              updated_at    = now()
         FROM (
           SELECT location, recorded_at FROM route_points
            WHERE session_id = $2 ORDER BY recorded_at DESC LIMIT 1
         ) p
        WHERE v.id = $1
          AND (v.last_seen_at IS NULL OR v.last_seen_at < p.recorded_at)`,
      [device.vehicleId, sessionId],
    );
  });

  const after = await one<{ points_count: number; distance_m: number }>(
    'SELECT points_count, distance_m FROM route_sessions WHERE id = $1',
    [sessionId],
  );

  return {
    accepted,
    duplicates,
    rejected: rejectedCount,
    pointsCount: after?.points_count ?? 0,
    distanceM: Math.round(after?.distance_m ?? 0),
  };
}

interface SessionRow {
  id: string;
  worker_id: string;
  worker_name: string | null;
  vehicle_id: string;
  vehicle_no: string | null;
  started_at: Date;
  ended_at: Date | null;
  service_day: string;
  points_count: number;
  distance_m: number;
  scans_count?: number;
}

const SESSION_SELECT = `
  SELECT rs.id, rs.worker_id, w.full_name AS worker_name,
         rs.vehicle_id, v.internal_no AS vehicle_no,
         rs.started_at, rs.ended_at, rs.service_day, rs.points_count, rs.distance_m
    FROM route_sessions rs
    LEFT JOIN workers w  ON w.id = rs.worker_id
    LEFT JOIN vehicles v ON v.id = rs.vehicle_id
`;

const toSessionDto = (r: SessionRow): SessionDto => ({
  id: r.id,
  workerId: r.worker_id,
  workerName: r.worker_name,
  vehicleId: r.vehicle_id,
  vehicleNo: r.vehicle_no,
  startedAt: r.started_at.toISOString(),
  endedAt: r.ended_at ? r.ended_at.toISOString() : null,
  serviceDay: r.service_day,
  pointsCount: r.points_count,
  distanceM: Math.round(r.distance_m),
  scansCount: r.scans_count,
});

export async function listSessions(
  companyId: string,
  q: { day?: string; vehicleId?: string; workerId?: string; limit?: number },
): Promise<SessionDto[]> {
  const where = ['rs.company_id = $1'];
  const params: unknown[] = [companyId];
  let p = 1;
  if (q.day) {
    where.push(`rs.service_day = $${++p}`);
    params.push(q.day);
  }
  if (q.vehicleId) {
    where.push(`rs.vehicle_id = $${++p}`);
    params.push(q.vehicleId);
  }
  if (q.workerId) {
    where.push(`rs.worker_id = $${++p}`);
    params.push(q.workerId);
  }
  const list = await rows<SessionRow>(
    `${SESSION_SELECT} WHERE ${where.join(' AND ')}
      ORDER BY rs.started_at DESC LIMIT ${Math.min(500, q.limit ?? 100)}`,
    params,
  );
  return list.map(toSessionDto);
}

export interface SessionTrack {
  session: SessionDto;
  geojson: {
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    properties: Record<string, unknown>;
  };
  scans: { id: string; binPublicId: string; lat: number; lon: number; status: string; at: string }[];
}

/** مسار الجلسة كـ GeoJSON جاهز للرسم على MapLibre، مع نقاط المسح عليه. */
export async function getSessionTrack(
  companyId: string,
  sessionId: string,
): Promise<SessionTrack> {
  const row = await one<SessionRow>(
    `${SESSION_SELECT} WHERE rs.id = $1 AND rs.company_id = $2`,
    [sessionId, companyId],
  );
  if (!row) throw notFound('الجلسة غير موجودة');

  const pts = await rows<{ lon: number; lat: number }>(
    `SELECT ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat
       FROM route_points WHERE session_id = $1 ORDER BY recorded_at`,
    [sessionId],
  );

  const scans = await rows<{
    id: string;
    bin_public_id: string;
    lat: number;
    lon: number;
    status: string;
    scanned_at: Date;
  }>(
    `SELECT s.id, b.public_id AS bin_public_id,
            ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lon,
            s.status, s.scanned_at
       FROM scans s JOIN bins b ON b.id = s.bin_id
      WHERE s.session_id = $1 ORDER BY s.scanned_at`,
    [sessionId],
  );

  return {
    session: toSessionDto(row),
    geojson: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lon, p.lat]) },
      properties: {
        sessionId,
        vehicleNo: row.vehicle_no,
        workerName: row.worker_name,
        distanceM: Math.round(row.distance_m),
      },
    },
    scans: scans.map((s) => ({
      id: s.id,
      binPublicId: s.bin_public_id,
      lat: s.lat,
      lon: s.lon,
      status: s.status,
      at: s.scanned_at.toISOString(),
    })),
  };
}

export interface LiveVehicle {
  vehicleId: string;
  internalNo: string;
  plateNo: string | null;
  workerName: string | null;
  lat: number | null;
  lon: number | null;
  lastSeenAt: string | null;
  online: boolean;
  doneToday: number;
  sessionId: string | null;
}

/** آخر موقع لكل سيارة + هل هي متصلة (نشاط خلال 15 دقيقة). */
export async function liveVehicles(companyId: string, day: string): Promise<LiveVehicle[]> {
  const list = await rows<{
    vehicle_id: string;
    internal_no: string;
    plate_no: string | null;
    worker_name: string | null;
    lat: number | null;
    lon: number | null;
    last_seen_at: Date | null;
    done_today: number;
    session_id: string | null;
  }>(
    `SELECT v.id AS vehicle_id, v.internal_no, v.plate_no,
            w.full_name AS worker_name,
            ST_Y(v.last_location::geometry) AS lat,
            ST_X(v.last_location::geometry) AS lon,
            v.last_seen_at,
            COALESCE(sc.done_today, 0)::int AS done_today,
            rs.id AS session_id
       FROM vehicles v
       LEFT JOIN workers w ON w.id = v.current_worker_id
       LEFT JOIN (
         SELECT vehicle_id, count(*) AS done_today FROM scans
          WHERE company_id = $1 AND service_day = $2 AND counted GROUP BY vehicle_id
       ) sc ON sc.vehicle_id = v.id
       LEFT JOIN LATERAL (
         SELECT id FROM route_sessions
          WHERE vehicle_id = v.id AND ended_at IS NULL
          ORDER BY started_at DESC LIMIT 1
       ) rs ON true
      WHERE v.company_id = $1 AND v.status <> 'INACTIVE'
      ORDER BY v.internal_no`,
    [companyId, day],
  );

  const cutoff = Date.now() - 15 * 60_000;
  return list.map((r) => ({
    vehicleId: r.vehicle_id,
    internalNo: r.internal_no,
    plateNo: r.plate_no,
    workerName: r.worker_name,
    lat: r.lat,
    lon: r.lon,
    lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
    online: Boolean(r.last_seen_at && r.last_seen_at.getTime() >= cutoff),
    doneToday: r.done_today,
    sessionId: r.session_id,
  }));
}
