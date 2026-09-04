import type { FastifyInstance } from 'fastify';
import { truncateAll } from '../src/db/migrate.js';
import { buildServer } from '../src/http/server.js';

export interface TestWorld {
  app: FastifyInstance;
  accessToken: string;
  companyId: string;
  adminId: string;
}

export const ADMIN = { username: 'admin', password: 'Admin#12345' };

let cachedApp: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!cachedApp) cachedApp = await buildServer();
  return cachedApp;
}

export async function closeApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
  }
}

/** قاعدة بيانات نظيفة + شركة مُعدّة + مدير مسجَّل الدخول. */
export async function freshWorld(
  overrides: { defaultGpsRadiusM?: number; timezone?: string } = {},
): Promise<TestWorld> {
  await truncateAll();
  const app = await getApp();

  const res = await app.inject({
    method: 'POST',
    url: '/v1/setup',
    payload: {
      company: {
        name: 'شركة النظافة المتحدة',
        city: 'الرياض',
        phone: '0500000000',
        email: 'ops@example.com',
        address: 'حي الملز',
        defaultGpsRadiusM: overrides.defaultGpsRadiusM ?? 30,
        timezone: overrides.timezone ?? 'Asia/Riyadh',
      },
      admin: {
        fullName: 'مدير النظام',
        username: ADMIN.username,
        email: 'admin@example.com',
        password: ADMIN.password,
      },
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`فشل الإعداد الأولي في الاختبار: ${res.statusCode} ${res.body}`);
  }
  const body = res.json() as {
    accessToken: string;
    company: { id: string };
    user: { id: string };
  };
  return {
    app,
    accessToken: body.accessToken,
    companyId: body.company.id,
    adminId: body.user.id,
  };
}

export const authHeader = (token: string) => ({ authorization: `Bearer ${token}` });
export const deviceHeader = (token: string) => ({ authorization: `Device ${token}` });

/** يُنشئ سيارة وعاملًا ويربطهما بجهاز مُفعَّل، ويُرجع رمز الجهاز. */
export async function setupDevice(
  w: TestWorld,
  opts: { vehicleNo?: string; employeeNo?: string; deviceUid?: string } = {},
): Promise<{
  deviceToken: string;
  workerId: string;
  vehicleId: string;
  deviceId: string;
}> {
  const h = authHeader(w.accessToken);

  const vehicle = await w.app.inject({
    method: 'POST',
    url: '/v1/vehicles',
    headers: h,
    payload: {
      internalNo: opts.vehicleNo ?? '07',
      name: 'ضاغط 07',
      plateNo: 'أ ب ج 1234',
      vehicleType: 'ضاغط',
    },
  });
  const vehicleId = (vehicle.json() as { id: string }).id;

  const worker = await w.app.inject({
    method: 'POST',
    url: '/v1/workers',
    headers: h,
    payload: {
      fullName: 'أحمد محمد',
      employeeNo: opts.employeeNo ?? 'E-1001',
      phone: '0511111111',
      defaultVehicleId: vehicleId,
    },
  });
  const workerId = (worker.json() as { id: string }).id;

  const code = await w.app.inject({
    method: 'POST',
    url: '/v1/devices/activation-codes',
    headers: h,
    payload: { workerId, vehicleId, ttlHours: 24 },
  });
  const activation = code.json() as { code: string };

  const activated = await w.app.inject({
    method: 'POST',
    url: '/v1/devices/activate',
    payload: {
      code: activation.code,
      deviceUid: opts.deviceUid ?? 'test-device-uid-0001',
      platform: 'android',
      model: 'Test',
      appVersion: '1.0.0',
    },
  });
  if (activated.statusCode !== 201) {
    throw new Error(`فشل تفعيل الجهاز: ${activated.statusCode} ${activated.body}`);
  }
  const out = activated.json() as { deviceToken: string; device: { id: string } };
  return {
    deviceToken: out.deviceToken,
    workerId,
    vehicleId,
    deviceId: out.device.id,
  };
}

export interface CreatedBin {
  id: string;
  publicId: string;
  lat: number;
  lon: number;
  qrToken: string;
}

/** ينشئ حاوية ويُرجع رمز QR الحقيقي الخاص بها. */
export async function createBin(
  w: TestWorld,
  input: {
    lat: number;
    lon: number;
    publicId?: string;
    sector?: string;
    gpsRadiusM?: number;
    name?: string;
  },
): Promise<CreatedBin> {
  const h = authHeader(w.accessToken);
  const res = await w.app.inject({
    method: 'POST',
    url: '/v1/bins',
    headers: h,
    payload: {
      publicId: input.publicId,
      name: input.name ?? 'حاوية اختبار',
      sector: input.sector ?? 'القطاع الأول',
      area: 'الملز',
      lat: input.lat,
      lon: input.lon,
      gpsRadiusM: input.gpsRadiusM,
    },
  });
  if (res.statusCode !== 201) throw new Error(`فشل إنشاء الحاوية: ${res.body}`);
  const bin = res.json() as { id: string; publicId: string; lat: number; lon: number };

  const detail = await w.app.inject({
    method: 'GET',
    url: `/v1/bins/${bin.id}`,
    headers: h,
  });
  const qrToken = (detail.json() as { qrToken: string }).qrToken;
  return { ...bin, qrToken };
}

let uuidCounter = 0;
/** UUID ثابت التسلسل لتسهيل التتبّع في الاختبارات. */
export function testUuid(): string {
  uuidCounter++;
  const hex = uuidCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

/** يزيح إحداثية شمالًا بعدد أمتار (تقريب كافٍ للاختبارات). */
export function offsetMeters(
  point: { lat: number; lon: number },
  north: number,
  east = 0,
): { lat: number; lon: number } {
  const dLat = north / 111_320;
  const dLon = east / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return { lat: point.lat + dLat, lon: point.lon + dLon };
}
