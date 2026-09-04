import { audit } from '../../core/audit.js';
import type { Ctx, DeviceActor } from '../../core/context.js';
import { activationCode, randomToken, sha256Hex } from '../../core/crypto.js';
import { AppError, notFound } from '../../core/errors.js';
import { one, rows, withTransaction } from '../../db/pool.js';
import { getVehicle, getWorker } from '../fleet/service.js';

export interface ActivationCodeDto {
  id: string;
  code: string;
  workerId: string;
  workerName: string;
  vehicleId: string;
  vehicleNo: string;
  expiresAt: string;
  consumedAt: string | null;
  activationPayload: string;
}

/** حمولة QR التفعيل التي يمسحها العامل. */
export const activationPayload = (code: string): string => `vero-activate:${code}`;

export async function createActivationCode(
  ctx: Ctx,
  input: { workerId: string; vehicleId: string; ttlHours?: number },
): Promise<ActivationCodeDto> {
  const worker = await getWorker(ctx.companyId, input.workerId);
  const vehicle = await getVehicle(ctx.companyId, input.vehicleId);
  if (worker.status !== 'ACTIVE') {
    throw new AppError('CONFLICT', 'لا يمكن إنشاء كود تفعيل لعامل موقوف');
  }
  const ttl = Math.min(24 * 30, Math.max(1, input.ttlHours ?? 72));
  const code = activationCode();
  const row = await one<{ id: string; code: string; expires_at: Date }>(
    `INSERT INTO activation_codes (company_id, code, worker_id, vehicle_id, created_by, expires_at)
     VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' hours')::interval)
     RETURNING id, code, expires_at`,
    [
      ctx.companyId,
      code,
      input.workerId,
      input.vehicleId,
      ctx.actor?.kind === 'user' ? ctx.actor.id : null,
      String(ttl),
    ],
  );
  if (!row) throw new AppError('INTERNAL', 'تعذّر إنشاء كود التفعيل');

  await audit(ctx, {
    action: 'device.activation_code.create',
    entity: 'activation_code',
    entityId: row.id,
    after: { workerId: input.workerId, vehicleId: input.vehicleId, expiresAt: row.expires_at },
  });

  return {
    id: row.id,
    code: row.code,
    workerId: worker.id,
    workerName: worker.full_name,
    vehicleId: vehicle.id,
    vehicleNo: vehicle.internal_no,
    expiresAt: row.expires_at.toISOString(),
    consumedAt: null,
    activationPayload: activationPayload(row.code),
  };
}

export async function listActivationCodes(companyId: string): Promise<ActivationCodeDto[]> {
  const list = await rows<{
    id: string;
    code: string;
    worker_id: string;
    worker_name: string;
    vehicle_id: string;
    vehicle_no: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `SELECT a.id, a.code, a.worker_id, w.full_name AS worker_name,
            a.vehicle_id, v.internal_no AS vehicle_no, a.expires_at, a.consumed_at
       FROM activation_codes a
       JOIN workers w  ON w.id = a.worker_id
       JOIN vehicles v ON v.id = a.vehicle_id
      WHERE a.company_id = $1
      ORDER BY a.created_at DESC
      LIMIT 200`,
    [companyId],
  );
  return list.map((r) => ({
    id: r.id,
    code: r.code,
    workerId: r.worker_id,
    workerName: r.worker_name,
    vehicleId: r.vehicle_id,
    vehicleNo: r.vehicle_no,
    expiresAt: r.expires_at.toISOString(),
    consumedAt: r.consumed_at ? r.consumed_at.toISOString() : null,
    activationPayload: activationPayload(r.code),
  }));
}

export interface ActivateInput {
  code: string;
  deviceUid: string;
  platform?: string;
  model?: string;
  appVersion?: string;
}

export interface ActivateResult {
  deviceToken: string;
  device: { id: string; deviceUid: string };
  worker: { id: string; fullName: string; employeeNo: string };
  vehicle: { id: string; internalNo: string; plateNo: string | null };
  company: { id: string; name: string; timezone: string };
}

/** ينظّف الكود المُدخل: يقبل الحمولة الكاملة من QR أو الكود المكتوب يدويًا. */
export function normalizeActivationCode(raw: string): string {
  let s = raw.trim();
  if (s.toLowerCase().startsWith('vero-activate:')) s = s.slice('vero-activate:'.length);
  s = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 8) return raw.trim().toUpperCase();
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * تفعيل جهاز العامل. الكود يُستهلك مرة واحدة فقط (شرط `consumed_at IS NULL` داخل UPDATE
 * الذري يمنع تفعيل جهازين بنفس الكود حتى مع طلبين متزامنين).
 */
export async function activateDevice(
  input: ActivateInput,
  meta: { ip?: string; userAgent?: string },
): Promise<ActivateResult> {
  const code = normalizeActivationCode(input.code);

  return withTransaction(async (tx) => {
    const codeRow = await tx.one<{
      id: string;
      company_id: string;
      worker_id: string;
      vehicle_id: string;
      expires_at: Date;
      consumed_at: Date | null;
    }>(
      `SELECT id, company_id, worker_id, vehicle_id, expires_at, consumed_at
         FROM activation_codes WHERE code = $1 FOR UPDATE`,
      [code],
    );
    if (!codeRow) throw new AppError('ACTIVATION_CODE_INVALID', 'كود التفعيل غير صحيح');
    if (codeRow.consumed_at) {
      throw new AppError('ACTIVATION_CODE_USED', 'كود التفعيل مستخدم مسبقًا');
    }
    if (codeRow.expires_at.getTime() < Date.now()) {
      throw new AppError('ACTIVATION_CODE_EXPIRED', 'انتهت صلاحية كود التفعيل');
    }

    const worker = await tx.one<{ id: string; full_name: string; employee_no: string; status: string }>(
      'SELECT id, full_name, employee_no, status FROM workers WHERE id = $1',
      [codeRow.worker_id],
    );
    const vehicle = await tx.one<{ id: string; internal_no: string; plate_no: string | null }>(
      'SELECT id, internal_no, plate_no FROM vehicles WHERE id = $1',
      [codeRow.vehicle_id],
    );
    const company = await tx.one<{ id: string; name: string; timezone: string }>(
      'SELECT id, name, timezone FROM companies WHERE id = $1',
      [codeRow.company_id],
    );
    if (!worker || !vehicle || !company) throw notFound('بيانات التفعيل غير مكتملة');
    if (worker.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'العامل موقوف');

    const token = randomToken(32);
    const device = await tx.one<{ id: string }>(
      `INSERT INTO devices (company_id, device_uid, platform, model, app_version, token_hash, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6, now()) RETURNING id`,
      [
        codeRow.company_id,
        input.deviceUid,
        input.platform ?? null,
        input.model ?? null,
        input.appVersion ?? null,
        sha256Hex(token),
      ],
    );
    if (!device) throw new AppError('INTERNAL', 'تعذّر تسجيل الجهاز');

    // جهاز واحد نشط لكل عامل: نفكّ أي ارتباط قديم لنفس العامل
    await tx.query(
      `UPDATE device_bindings SET unbound_at = now()
        WHERE worker_id = $1 AND unbound_at IS NULL`,
      [worker.id],
    );
    await tx.query(
      `INSERT INTO device_bindings (company_id, device_id, worker_id, vehicle_id)
       VALUES ($1,$2,$3,$4)`,
      [codeRow.company_id, device.id, worker.id, vehicle.id],
    );
    await tx.query(
      'UPDATE activation_codes SET consumed_at = now(), consumed_device_id = $2 WHERE id = $1',
      [codeRow.id, device.id],
    );
    await tx.query(
      'UPDATE vehicles SET current_worker_id = $2, updated_at = now() WHERE id = $1',
      [vehicle.id, worker.id],
    );

    const ctx: Ctx = {
      companyId: codeRow.company_id,
      actor: {
        kind: 'device',
        id: device.id,
        companyId: codeRow.company_id,
        workerId: worker.id,
        vehicleId: vehicle.id,
        deviceUid: input.deviceUid,
      },
      meta,
    };
    await audit(
      ctx,
      {
        action: 'device.activate',
        entity: 'device',
        entityId: device.id,
        after: { workerId: worker.id, vehicleId: vehicle.id, deviceUid: input.deviceUid },
      },
      tx,
    );

    return {
      deviceToken: token,
      device: { id: device.id, deviceUid: input.deviceUid },
      worker: { id: worker.id, fullName: worker.full_name, employeeNo: worker.employee_no },
      vehicle: { id: vehicle.id, internalNo: vehicle.internal_no, plateNo: vehicle.plate_no },
      company: { id: company.id, name: company.name, timezone: company.timezone },
    };
  });
}

export interface ResolvedDevice extends DeviceActor {
  workerName: string;
  vehicleNo: string;
  companyTimezone: string;
}

/** يحوّل رمز الجهاز إلى هوية كاملة، أو يرمي خطأ صريحًا. */
export async function resolveDeviceToken(token: string): Promise<ResolvedDevice> {
  const row = await one<{
    id: string;
    company_id: string;
    device_uid: string;
    status: string;
    worker_id: string | null;
    vehicle_id: string | null;
    worker_name: string | null;
    worker_status: string | null;
    vehicle_no: string | null;
    timezone: string;
  }>(
    `SELECT d.id, d.company_id, d.device_uid, d.status,
            b.worker_id, b.vehicle_id,
            w.full_name AS worker_name, w.status AS worker_status,
            v.internal_no AS vehicle_no,
            c.timezone
       FROM devices d
       JOIN companies c ON c.id = d.company_id
       LEFT JOIN device_bindings b ON b.device_id = d.id AND b.unbound_at IS NULL
       LEFT JOIN workers w  ON w.id = b.worker_id
       LEFT JOIN vehicles v ON v.id = b.vehicle_id
      WHERE d.token_hash = $1`,
    [sha256Hex(token)],
  );

  if (!row) throw new AppError('INVALID_TOKEN', 'رمز الجهاز غير صالح');
  if (row.status !== 'ACTIVE') throw new AppError('DEVICE_REVOKED', 'تم إلغاء تفعيل هذا الجهاز');
  if (!row.worker_id || !row.vehicle_id) {
    throw new AppError('DEVICE_NOT_BOUND', 'الجهاز غير مرتبط بعامل وسيارة');
  }
  if (row.worker_status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', 'العامل المرتبط بالجهاز موقوف');
  }

  return {
    kind: 'device',
    id: row.id,
    companyId: row.company_id,
    workerId: row.worker_id,
    vehicleId: row.vehicle_id,
    deviceUid: row.device_uid,
    workerName: row.worker_name ?? '',
    vehicleNo: row.vehicle_no ?? '',
    companyTimezone: row.timezone,
  };
}

export async function touchDevice(deviceId: string): Promise<void> {
  await one('UPDATE devices SET last_seen_at = now() WHERE id = $1', [deviceId]);
}

export async function revokeDevice(ctx: Ctx, deviceId: string): Promise<void> {
  const before = await one<{ id: string; device_uid: string; status: string }>(
    'SELECT id, device_uid, status FROM devices WHERE id = $1 AND company_id = $2',
    [deviceId, ctx.companyId],
  );
  if (!before) throw notFound('الجهاز غير موجود');
  await withTransaction(async (tx) => {
    await tx.query("UPDATE devices SET status = 'REVOKED' WHERE id = $1", [deviceId]);
    await tx.query(
      'UPDATE device_bindings SET unbound_at = now() WHERE device_id = $1 AND unbound_at IS NULL',
      [deviceId],
    );
  });
  await audit(ctx, {
    action: 'device.revoke',
    entity: 'device',
    entityId: deviceId,
    before: { status: before.status },
    after: { status: 'REVOKED' },
  });
}

export interface DeviceListItem {
  id: string;
  deviceUid: string;
  platform: string | null;
  model: string | null;
  appVersion: string | null;
  status: string;
  lastSeenAt: string | null;
  workerName: string | null;
  vehicleNo: string | null;
}

export async function listDevices(companyId: string): Promise<DeviceListItem[]> {
  const list = await rows<{
    id: string;
    device_uid: string;
    platform: string | null;
    model: string | null;
    app_version: string | null;
    status: string;
    last_seen_at: Date | null;
    worker_name: string | null;
    vehicle_no: string | null;
  }>(
    `SELECT d.id, d.device_uid, d.platform, d.model, d.app_version, d.status, d.last_seen_at,
            w.full_name AS worker_name, v.internal_no AS vehicle_no
       FROM devices d
       LEFT JOIN device_bindings b ON b.device_id = d.id AND b.unbound_at IS NULL
       LEFT JOIN workers w  ON w.id = b.worker_id
       LEFT JOIN vehicles v ON v.id = b.vehicle_id
      WHERE d.company_id = $1
      ORDER BY d.created_at DESC`,
    [companyId],
  );
  return list.map((r) => ({
    id: r.id,
    deviceUid: r.device_uid,
    platform: r.platform,
    model: r.model,
    appVersion: r.app_version,
    status: r.status,
    lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
    workerName: r.worker_name,
    vehicleNo: r.vehicle_no,
  }));
}
