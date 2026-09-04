import { audit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import { AppError, conflict, notFound } from '../../core/errors.js';
import { one, rows } from '../../db/pool.js';

const UNIQUE_VIOLATION = '23505';

// ═══════════════════════════ السيارات ═══════════════════════════

export interface VehicleRow {
  id: string;
  company_id: string;
  internal_no: string;
  name: string | null;
  plate_no: string | null;
  vehicle_type: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  current_worker_id: string | null;
  last_seen_at: Date | null;
  created_at: Date;
}

export interface VehicleDto {
  id: string;
  internalNo: string;
  name: string | null;
  plateNo: string | null;
  vehicleType: string | null;
  status: string;
  currentWorkerId: string | null;
  currentWorkerName?: string | null;
  lastSeenAt: string | null;
  lastLocation?: { lat: number; lon: number } | null;
  doneToday?: number;
  createdAt: string;
}

const toVehicleDto = (r: VehicleRow): VehicleDto => ({
  id: r.id,
  internalNo: r.internal_no,
  name: r.name,
  plateNo: r.plate_no,
  vehicleType: r.vehicle_type,
  status: r.status,
  currentWorkerId: r.current_worker_id,
  lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
});

interface VehicleListRow extends VehicleRow {
  worker_name: string | null;
  lat: number | null;
  lon: number | null;
  done_today: number;
}

export async function listVehicles(
  companyId: string,
  serviceDay: string,
): Promise<VehicleDto[]> {
  const list = await rows<VehicleListRow>(
    `SELECT v.*,
            w.full_name AS worker_name,
            ST_Y(v.last_location::geometry) AS lat,
            ST_X(v.last_location::geometry) AS lon,
            COALESCE(s.done_today, 0)::int AS done_today
       FROM vehicles v
       LEFT JOIN workers w ON w.id = v.current_worker_id
       LEFT JOIN (
         SELECT vehicle_id, count(*) AS done_today
           FROM scans
          WHERE company_id = $1 AND service_day = $2 AND counted
          GROUP BY vehicle_id
       ) s ON s.vehicle_id = v.id
      WHERE v.company_id = $1
      ORDER BY v.internal_no`,
    [companyId, serviceDay],
  );
  return list.map((r) => ({
    ...toVehicleDto(r),
    currentWorkerName: r.worker_name,
    lastLocation: r.lat !== null && r.lon !== null ? { lat: r.lat, lon: r.lon } : null,
    doneToday: r.done_today,
  }));
}

export interface VehicleInput {
  internalNo: string;
  name?: string | null;
  plateNo?: string | null;
  vehicleType?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

export async function createVehicle(ctx: Ctx, input: VehicleInput): Promise<VehicleDto> {
  let row: VehicleRow | null;
  try {
    row = await one<VehicleRow>(
      `INSERT INTO vehicles (company_id, internal_no, name, plate_no, vehicle_type, status)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'ACTIVE')) RETURNING *`,
      [
        ctx.companyId,
        input.internalNo,
        input.name ?? null,
        input.plateNo ?? null,
        input.vehicleType ?? null,
        input.status ?? null,
      ],
    );
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict(`الرقم الداخلي للسيارة مستخدم مسبقًا: ${input.internalNo}`);
    }
    throw err;
  }
  if (!row) throw new AppError('INTERNAL', 'تعذّر إنشاء السيارة');
  await audit(ctx, {
    action: 'vehicle.create',
    entity: 'vehicle',
    entityId: row.id,
    after: toVehicleDto(row),
  });
  return toVehicleDto(row);
}

export async function updateVehicle(
  ctx: Ctx,
  id: string,
  input: Partial<VehicleInput>,
): Promise<VehicleDto> {
  const before = await getVehicle(ctx.companyId, id);
  const after = await one<VehicleRow>(
    `UPDATE vehicles SET
       internal_no  = COALESCE($3, internal_no),
       name         = COALESCE($4, name),
       plate_no     = COALESCE($5, plate_no),
       vehicle_type = COALESCE($6, vehicle_type),
       status       = COALESCE($7, status),
       updated_at   = now()
     WHERE id = $1 AND company_id = $2 RETURNING *`,
    [
      id,
      ctx.companyId,
      input.internalNo ?? null,
      input.name ?? null,
      input.plateNo ?? null,
      input.vehicleType ?? null,
      input.status ?? null,
    ],
  );
  if (!after) throw notFound('السيارة غير موجودة');
  await audit(ctx, {
    action: 'vehicle.update',
    entity: 'vehicle',
    entityId: id,
    before: toVehicleDto(before),
    after: toVehicleDto(after),
  });
  return toVehicleDto(after);
}

export async function getVehicle(companyId: string, id: string): Promise<VehicleRow> {
  const row = await one<VehicleRow>(
    'SELECT * FROM vehicles WHERE id = $1 AND company_id = $2',
    [id, companyId],
  );
  if (!row) throw notFound('السيارة غير موجودة');
  return row;
}

export async function deleteVehicle(ctx: Ctx, id: string): Promise<void> {
  const before = await getVehicle(ctx.companyId, id);
  await one('DELETE FROM vehicles WHERE id = $1 AND company_id = $2', [id, ctx.companyId]);
  await audit(ctx, {
    action: 'vehicle.delete',
    entity: 'vehicle',
    entityId: id,
    before: toVehicleDto(before),
  });
}

/** تغيير السائق الحالي لسيارة. */
export async function assignDriver(
  ctx: Ctx,
  vehicleId: string,
  workerId: string | null,
): Promise<VehicleDto> {
  const before = await getVehicle(ctx.companyId, vehicleId);
  if (workerId) await getWorker(ctx.companyId, workerId);
  const after = await one<VehicleRow>(
    'UPDATE vehicles SET current_worker_id = $3, updated_at = now() WHERE id = $1 AND company_id = $2 RETURNING *',
    [vehicleId, ctx.companyId, workerId],
  );
  if (!after) throw notFound('السيارة غير موجودة');
  await audit(ctx, {
    action: 'vehicle.assign_driver',
    entity: 'vehicle',
    entityId: vehicleId,
    before: { currentWorkerId: before.current_worker_id },
    after: { currentWorkerId: after.current_worker_id },
  });
  return toVehicleDto(after);
}

// ═══════════════════════════ العمال ═══════════════════════════

export interface WorkerRow {
  id: string;
  company_id: string;
  full_name: string;
  employee_no: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  default_vehicle_id: string | null;
  created_at: Date;
}

export interface WorkerDto {
  id: string;
  fullName: string;
  employeeNo: string;
  phone: string | null;
  status: string;
  defaultVehicleId: string | null;
  defaultVehicleNo?: string | null;
  doneToday?: number;
  createdAt: string;
}

const toWorkerDto = (r: WorkerRow): WorkerDto => ({
  id: r.id,
  fullName: r.full_name,
  employeeNo: r.employee_no,
  phone: r.phone,
  status: r.status,
  defaultVehicleId: r.default_vehicle_id,
  createdAt: r.created_at.toISOString(),
});

export async function listWorkers(companyId: string, serviceDay: string): Promise<WorkerDto[]> {
  const list = await rows<WorkerRow & { vehicle_no: string | null; done_today: number }>(
    `SELECT w.*, v.internal_no AS vehicle_no, COALESCE(s.done_today,0)::int AS done_today
       FROM workers w
       LEFT JOIN vehicles v ON v.id = w.default_vehicle_id
       LEFT JOIN (
         SELECT worker_id, count(*) AS done_today FROM scans
          WHERE company_id = $1 AND service_day = $2 AND counted
          GROUP BY worker_id
       ) s ON s.worker_id = w.id
      WHERE w.company_id = $1
      ORDER BY w.full_name`,
    [companyId, serviceDay],
  );
  return list.map((r) => ({
    ...toWorkerDto(r),
    defaultVehicleNo: r.vehicle_no,
    doneToday: r.done_today,
  }));
}

export interface WorkerInput {
  fullName: string;
  employeeNo: string;
  phone?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  defaultVehicleId?: string | null;
}

export async function createWorker(ctx: Ctx, input: WorkerInput): Promise<WorkerDto> {
  if (input.defaultVehicleId) await getVehicle(ctx.companyId, input.defaultVehicleId);
  let row: WorkerRow | null;
  try {
    row = await one<WorkerRow>(
      `INSERT INTO workers (company_id, full_name, employee_no, phone, status, default_vehicle_id)
       VALUES ($1,$2,$3,$4,COALESCE($5,'ACTIVE'),$6) RETURNING *`,
      [
        ctx.companyId,
        input.fullName,
        input.employeeNo,
        input.phone ?? null,
        input.status ?? null,
        input.defaultVehicleId ?? null,
      ],
    );
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict(`الرقم الوظيفي مستخدم مسبقًا: ${input.employeeNo}`);
    }
    throw err;
  }
  if (!row) throw new AppError('INTERNAL', 'تعذّر إنشاء العامل');
  await audit(ctx, {
    action: 'worker.create',
    entity: 'worker',
    entityId: row.id,
    after: toWorkerDto(row),
  });
  return toWorkerDto(row);
}

export async function getWorker(companyId: string, id: string): Promise<WorkerRow> {
  const row = await one<WorkerRow>('SELECT * FROM workers WHERE id = $1 AND company_id = $2', [
    id,
    companyId,
  ]);
  if (!row) throw notFound('العامل غير موجود');
  return row;
}

export async function updateWorker(
  ctx: Ctx,
  id: string,
  input: Partial<WorkerInput>,
): Promise<WorkerDto> {
  const before = await getWorker(ctx.companyId, id);
  if (input.defaultVehicleId) await getVehicle(ctx.companyId, input.defaultVehicleId);
  const after = await one<WorkerRow>(
    `UPDATE workers SET
       full_name          = COALESCE($3, full_name),
       employee_no        = COALESCE($4, employee_no),
       phone              = COALESCE($5, phone),
       status             = COALESCE($6, status),
       default_vehicle_id = COALESCE($7, default_vehicle_id),
       updated_at         = now()
     WHERE id = $1 AND company_id = $2 RETURNING *`,
    [
      id,
      ctx.companyId,
      input.fullName ?? null,
      input.employeeNo ?? null,
      input.phone ?? null,
      input.status ?? null,
      input.defaultVehicleId ?? null,
    ],
  );
  if (!after) throw notFound('العامل غير موجود');
  await audit(ctx, {
    action: 'worker.update',
    entity: 'worker',
    entityId: id,
    before: toWorkerDto(before),
    after: toWorkerDto(after),
  });
  return toWorkerDto(after);
}

export async function deleteWorker(ctx: Ctx, id: string): Promise<void> {
  const before = await getWorker(ctx.companyId, id);
  await one('DELETE FROM workers WHERE id = $1 AND company_id = $2', [id, ctx.companyId]);
  await audit(ctx, {
    action: 'worker.delete',
    entity: 'worker',
    entityId: id,
    before: toWorkerDto(before),
  });
}
