import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool } from '../src/db/pool.js';
import {
  authHeader,
  closeApp,
  createBin,
  deviceHeader,
  freshWorld,
  offsetMeters,
  setupDevice,
  testUuid,
  type TestWorld,
} from './helpers.js';

const RIYADH = { lat: 24.7136, lon: 46.6753 };

let w: TestWorld;
let dev: Awaited<ReturnType<typeof setupDevice>>;

beforeAll(async () => {
  w = await freshWorld();
  dev = await setupDevice(w);
});

afterAll(async () => {
  await closeApp();
  await closePool();
});

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe('تفعيل الأجهزة وربطها', () => {
  it('الجهاز المُفعَّل يعرف عامله وسيارته', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/devices/me',
      headers: deviceHeader(dev.deviceToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.worker.id).toBe(dev.workerId);
    expect(body.vehicle.id).toBe(dev.vehicleId);
    expect(body.company.name).toBe('شركة النظافة المتحدة');
    expect(typeof body.doneToday).toBe('number');
  });

  it('كود التفعيل يُستهلك مرة واحدة فقط', async () => {
    const h = authHeader(w.accessToken);
    const vehicle = await w.app.inject({
      method: 'POST',
      url: '/v1/vehicles',
      headers: h,
      payload: { internalNo: '08' },
    });
    const worker = await w.app.inject({
      method: 'POST',
      url: '/v1/workers',
      headers: h,
      payload: { fullName: 'سالم علي', employeeNo: 'E-2002' },
    });
    const code = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activation-codes',
      headers: h,
      payload: {
        workerId: worker.json().id,
        vehicleId: vehicle.json().id,
      },
    });
    const c = code.json().code as string;

    const first = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activate',
      payload: { code: c, deviceUid: 'device-A' },
    });
    expect(first.statusCode).toBe(201);

    const second = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activate',
      payload: { code: c, deviceUid: 'device-B' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('ACTIVATION_CODE_USED');
  });

  it('يرفض كود تفعيل غير موجود', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activate',
      payload: { code: 'ZZZZ-9999', deviceUid: 'device-X' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('ACTIVATION_CODE_INVALID');
  });

  it('يقبل الكود ممسوحًا من QR بصيغته الكاملة', async () => {
    const h = authHeader(w.accessToken);
    const vehicle = await w.app.inject({
      method: 'POST',
      url: '/v1/vehicles',
      headers: h,
      payload: { internalNo: '09' },
    });
    const worker = await w.app.inject({
      method: 'POST',
      url: '/v1/workers',
      headers: h,
      payload: { fullName: 'خالد سعد', employeeNo: 'E-2003' },
    });
    const code = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activation-codes',
      headers: h,
      payload: { workerId: worker.json().id, vehicleId: vehicle.json().id },
    });
    const payload = code.json().activationPayload as string;
    expect(payload.startsWith('vero-activate:')).toBe(true);

    const activated = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activate',
      payload: { code: payload, deviceUid: 'device-qr' },
    });
    expect(activated.statusCode).toBe(201);
  });

  it('الجهاز الملغى يُرفض فورًا', async () => {
    const h = authHeader(w.accessToken);
    const vehicle = await w.app.inject({
      method: 'POST',
      url: '/v1/vehicles',
      headers: h,
      payload: { internalNo: '10' },
    });
    const worker = await w.app.inject({
      method: 'POST',
      url: '/v1/workers',
      headers: h,
      payload: { fullName: 'فهد ناصر', employeeNo: 'E-2004' },
    });
    const code = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activation-codes',
      headers: h,
      payload: { workerId: worker.json().id, vehicleId: vehicle.json().id },
    });
    const activated = await w.app.inject({
      method: 'POST',
      url: '/v1/devices/activate',
      payload: { code: code.json().code, deviceUid: 'device-revoke' },
    });
    const token = activated.json().deviceToken as string;
    const deviceId = activated.json().device.id as string;

    expect(
      (await w.app.inject({ method: 'GET', url: '/v1/devices/me', headers: deviceHeader(token) }))
        .statusCode,
    ).toBe(200);

    await w.app.inject({
      method: 'POST',
      url: `/v1/devices/${deviceId}/revoke`,
      headers: h,
    });

    const after = await w.app.inject({
      method: 'GET',
      url: '/v1/devices/me',
      headers: deviceHeader(token),
    });
    expect(after.statusCode).toBe(403);
    expect(after.json().error.code).toBe('DEVICE_REVOKED');
  });

  it('يرفض رمز جهاز مزيّف', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/devices/me',
      headers: deviceHeader('totally-fake-token'),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_TOKEN');
  });

  it('مسارات الجهاز مرفوضة برمز مستخدم لوحة الإدارة', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/devices/me',
      headers: authHeader(w.accessToken),
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('مزامنة العمليات المحفوظة أوفلاين', () => {
  it('يزامن دفعة كاملة ويحفظها كعمليات أوفلاين', async () => {
    const bins = await Promise.all([
      createBin(w, { ...offsetMeters(RIYADH, 0, 0), publicId: 'VR-200001' }),
      createBin(w, { ...offsetMeters(RIYADH, 0, 40), publicId: 'VR-200002' }),
      createBin(w, { ...offsetMeters(RIYADH, 0, 80), publicId: 'VR-200003' }),
    ]);

    const items = bins.map((b, i) => ({
      clientUuid: testUuid(),
      token: b.qrToken,
      lat: b.lat,
      lon: b.lon,
      accuracyM: 10,
      scannedAt: minutesAgo(50 - i * 5),
    }));

    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/sync/scans',
      headers: deviceHeader(dev.deviceToken),
      payload: { items },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summary.accepted).toBe(3);
    expect(body.summary.rejected).toBe(0);
    for (const r of body.results) {
      expect(r.status).toBe('VERIFIED');
      expect(r.counted).toBe(true);
    }

    const list = await w.app.inject({
      method: 'GET',
      url: '/v1/scans?countedOnly=true',
      headers: authHeader(w.accessToken),
    });
    const offlineOnes = (list.json().items as { offline: boolean }[]).filter((s) => s.offline);
    expect(offlineOnes.length).toBeGreaterThanOrEqual(3);
  });

  it('إعادة إرسال نفس الدفعة لا تُنشئ تكرارًا', async () => {
    const bin = await createBin(w, { ...offsetMeters(RIYADH, 0, 120), publicId: 'VR-200010' });
    const items = [
      {
        clientUuid: testUuid(),
        token: bin.qrToken,
        lat: bin.lat,
        lon: bin.lon,
        accuracyM: 9,
        scannedAt: minutesAgo(30),
      },
    ];

    const first = await w.app.inject({
      method: 'POST',
      url: '/v1/sync/scans',
      headers: deviceHeader(dev.deviceToken),
      payload: { items },
    });
    const second = await w.app.inject({
      method: 'POST',
      url: '/v1/sync/scans',
      headers: deviceHeader(dev.deviceToken),
      payload: { items },
    });

    expect(first.json().summary.accepted).toBe(1);
    expect(second.json().summary.accepted).toBe(0);
    expect(second.json().summary.duplicates).toBe(1);
    expect(second.json().results[0].scanId).toBe(first.json().results[0].scanId);

    const list = await w.app.inject({
      method: 'GET',
      url: `/v1/scans?binId=${bin.id}`,
      headers: authHeader(w.accessToken),
    });
    expect(list.json().total).toBe(1);
  });

  it('الدفعة المختلطة تُعالج جزئيًا ولا تسقط كاملة', async () => {
    const good = await createBin(w, { ...offsetMeters(RIYADH, 0, 160), publicId: 'VR-200020' });
    const items = [
      {
        clientUuid: testUuid(),
        token: good.qrToken,
        lat: good.lat,
        lon: good.lon,
        accuracyM: 8,
        scannedAt: minutesAgo(20),
      },
      {
        clientUuid: testUuid(),
        token: 'vero1.VR-999999.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb',
        lat: RIYADH.lat,
        lon: RIYADH.lon,
        accuracyM: 8,
        scannedAt: minutesAgo(19),
      },
    ];

    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/sync/scans',
      headers: deviceHeader(dev.deviceToken),
      payload: { items },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().summary.accepted).toBe(1);
    expect(res.json().summary.rejected).toBe(1);
    expect(res.json().results[1].reasons).toContain('TOKEN_BAD_SIGNATURE');
  });

  it('حالة المزامنة تعكس ما وصل الخادم فعليًا', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/sync/state',
      headers: deviceHeader(dev.deviceToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().syncedOffline).toBeGreaterThan(0);
  });
});

describe('جلسات العمل وخط السير', () => {
  it('يبدأ جلسة ويستقبل نقاط المسار ويحسب المسافة', async () => {
    const start = await w.app.inject({
      method: 'POST',
      url: '/v1/routes/sessions',
      headers: deviceHeader(dev.deviceToken),
      payload: {},
    });
    expect(start.statusCode).toBe(201);
    const sessionId = start.json().sessionId as string;

    const points = Array.from({ length: 10 }, (_, i) => ({
      clientUuid: testUuid(),
      ...offsetMeters(RIYADH, 0, i * 100),
      recordedAt: minutesAgo(40 - i * 2),
      speedMps: 8,
      accuracyM: 6,
    }));

    const sync = await w.app.inject({
      method: 'POST',
      url: '/v1/sync/route-points',
      headers: deviceHeader(dev.deviceToken),
      payload: { sessionId, points },
    });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().accepted).toBe(10);
    expect(sync.json().pointsCount).toBe(10);
    // 9 مسافات × 100 م
    expect(sync.json().distanceM).toBeGreaterThan(850);
    expect(sync.json().distanceM).toBeLessThan(950);

    // إعادة إرسال النقاط نفسها لا تُضاعف المسافة
    const again = await w.app.inject({
      method: 'POST',
      url: '/v1/sync/route-points',
      headers: deviceHeader(dev.deviceToken),
      payload: { sessionId, points },
    });
    expect(again.json().accepted).toBe(0);
    expect(again.json().duplicates).toBe(10);
    expect(again.json().pointsCount).toBe(10);

    const track = await w.app.inject({
      method: 'GET',
      url: `/v1/routes/sessions/${sessionId}`,
      headers: authHeader(w.accessToken),
    });
    expect(track.statusCode).toBe(200);
    expect(track.json().geojson.geometry.type).toBe('LineString');
    expect(track.json().geojson.geometry.coordinates).toHaveLength(10);

    const end = await w.app.inject({
      method: 'POST',
      url: `/v1/routes/sessions/${sessionId}/end`,
      headers: deviceHeader(dev.deviceToken),
    });
    expect(end.statusCode).toBe(200);
  });

  it('السيارة تظهر في العرض المباشر بآخر موقع', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/routes/live',
      headers: authHeader(w.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const mine = (res.json().items as { vehicleId: string; lat: number | null }[]).find(
      (v) => v.vehicleId === dev.vehicleId,
    );
    expect(mine).toBeDefined();
    expect(mine!.lat).not.toBeNull();
  });

  it('يرفض نقاط مسار لجلسة جهاز آخر', async () => {
    const other = await setupDevice(w, {
      vehicleNo: '77',
      employeeNo: 'E-7777',
      deviceUid: 'device-other',
    });
    const start = await w.app.inject({
      method: 'POST',
      url: '/v1/routes/sessions',
      headers: deviceHeader(other.deviceToken),
      payload: {},
    });
    const otherSession = start.json().sessionId as string;

    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/sync/route-points',
      headers: deviceHeader(dev.deviceToken),
      payload: {
        sessionId: otherSession,
        points: [
          {
            clientUuid: testUuid(),
            ...RIYADH,
            recordedAt: minutesAgo(5),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(404);
  });
});
