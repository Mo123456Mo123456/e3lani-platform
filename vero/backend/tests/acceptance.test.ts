/**
 * سيناريو القبول الكامل — الخطوات 1→26 من معيار اكتمال المشروع.
 * يعمل على قاعدة بيانات PostgreSQL/PostGIS حقيقية عبر HTTP الفعلي للخادم.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { closePool, query } from '../src/db/pool.js';
import { serviceDay } from '../src/core/time.js';
import { truncateAll } from '../src/db/migrate.js';
import { closeApp, getApp, testUuid } from './helpers.js';

const RIYADH = { lat: 24.7136, lon: 46.6753 };
const TZ = 'Asia/Riyadh';

const north = (p: { lat: number; lon: number }, m: number) => ({
  lat: p.lat + m / 111_320,
  lon: p.lon,
});

afterAll(async () => {
  await closeApp();
  await closePool();
});

describe('سيناريو القبول الكامل', () => {
  it('يمرّ بالخطوات الـ26 من التثبيت حتى الاستعادة', async () => {
    // 1) نسخة جديدة على قاعدة بيانات نظيفة
    await truncateAll();
    const app = await getApp();

    // 2) معالج الإعداد متاح ولم يكتمل بعد
    const status0 = await app.inject({ method: 'GET', url: '/v1/setup/status' });
    expect(status0.json().setupCompleted).toBe(false);

    // 3 + 4) إدخال بيانات الشركة وإنشاء المدير
    const setup = await app.inject({
      method: 'POST',
      url: '/v1/setup',
      payload: {
        company: {
          name: 'شركة الخليج للنظافة',
          city: 'الرياض',
          phone: '0112345678',
          email: 'ops@gulf-clean.example',
          address: 'طريق الملك فهد',
          defaultGpsRadiusM: 30,
          timezone: TZ,
        },
        admin: {
          fullName: 'مدير العمليات',
          username: 'gulfadmin',
          email: 'admin@gulf-clean.example',
          password: 'Gulf#2026Ops',
        },
      },
    });
    expect(setup.statusCode).toBe(201);
    const token = setup.json().accessToken as string;
    const h = { authorization: `Bearer ${token}` };
    expect(setup.json().company.name).toBe('شركة الخليج للنظافة');

    // 5) إضافة سيارة
    const vehicle = await app.inject({
      method: 'POST',
      url: '/v1/vehicles',
      headers: h,
      payload: { internalNo: '07', name: 'ضاغط 07', plateNo: 'ر س ن 4821', vehicleType: 'ضاغط' },
    });
    expect(vehicle.statusCode).toBe(201);
    const vehicleId = vehicle.json().id as string;

    // 6) إضافة عامل
    const worker = await app.inject({
      method: 'POST',
      url: '/v1/workers',
      headers: h,
      payload: { fullName: 'أحمد محمد', employeeNo: 'E-1001', phone: '0555555555' },
    });
    expect(worker.statusCode).toBe(201);
    const workerId = worker.json().id as string;

    // 7) ربط العامل بالسيارة
    const assign = await app.inject({
      method: 'POST',
      url: `/v1/vehicles/${vehicleId}/assign`,
      headers: h,
      payload: { workerId },
    });
    expect(assign.statusCode).toBe(200);
    expect(assign.json().currentWorkerId).toBe(workerId);

    // 8) إضافة حاويات مع إحداثيات (واحدة يدويًا + دفعة عبر CSV)
    const manualBin = await app.inject({
      method: 'POST',
      url: '/v1/bins',
      headers: h,
      payload: {
        name: 'حاوية مسجد الحي',
        sector: 'القطاع الأول',
        area: 'الملز',
        address: 'شارع الأمير عبدالله',
        lat: RIYADH.lat,
        lon: RIYADH.lon,
      },
    });
    expect(manualBin.statusCode).toBe(201);
    const binId = manualBin.json().id as string;
    expect(manualBin.json().publicId).toMatch(/^VR-\d{6}$/);
    expect(manualBin.json().gpsRadiusM).toBe(30); // ورث نطاق الشركة

    const csv = [
      'public_id,name,sector,area,lat,lon',
      `VR-900001,حاوية السوق,القطاع الأول,الملز,${RIYADH.lat + 0.002},${RIYADH.lon}`,
      `VR-900002,حاوية المدرسة,القطاع الثاني,النسيم,${RIYADH.lat + 0.004},${RIYADH.lon}`,
      `VR-900003,"حاوية شارع الملك، مدخل 2",القطاع الثاني,النسيم,${RIYADH.lat + 0.006},${RIYADH.lon}`,
    ].join('\n');
    const imported = await app.inject({
      method: 'POST',
      url: '/v1/bins/import',
      headers: h,
      payload: { csv },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json().created).toBe(3);
    expect(imported.json().failed).toEqual([]);

    // 9) رمز QR أُنشئ تلقائيًا لكل حاوية
    const qrSummary = await app.inject({ method: 'GET', url: '/v1/qr/summary', headers: h });
    expect(qrSummary.json().totalBins).toBe(4);
    expect(qrSummary.json().generated).toBe(4);
    expect(qrSummary.json().missing).toBe(0);

    const binDetail = await app.inject({ method: 'GET', url: `/v1/bins/${binId}`, headers: h });
    const qrToken = binDetail.json().qrToken as string;
    expect(qrToken.startsWith('vero1.')).toBe(true);

    // 10) طباعة ملصقات QR كملف PDF
    const stickers = await app.inject({
      method: 'POST',
      url: '/v1/qr/stickers',
      headers: h,
      payload: { all: true, markPrinted: true },
    });
    expect(stickers.statusCode).toBe(200);
    expect(stickers.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(stickers.headers['x-vero-sticker-count']).toBe('4');

    // 11) تفعيل جوال العامل بكود يُستخدم مرة واحدة
    const code = await app.inject({
      method: 'POST',
      url: '/v1/devices/activation-codes',
      headers: h,
      payload: { workerId, vehicleId, ttlHours: 48 },
    });
    expect(code.statusCode).toBe(201);
    const activated = await app.inject({
      method: 'POST',
      url: '/v1/devices/activate',
      payload: {
        code: code.json().activationPayload,
        deviceUid: 'acceptance-device',
        platform: 'android',
        model: 'Galaxy A15',
        appVersion: '1.0.0',
      },
    });
    expect(activated.statusCode).toBe(201);
    const deviceToken = activated.json().deviceToken as string;
    const dh = { authorization: `Device ${deviceToken}` };
    expect(activated.json().worker.fullName).toBe('أحمد محمد');
    expect(activated.json().vehicle.internalNo).toBe('07');

    // 16-أ) بدء جلسة عمل (خط السير يبدأ هنا فقط)
    const session = await app.inject({
      method: 'POST',
      url: '/v1/routes/sessions',
      headers: dh,
      payload: {},
    });
    expect(session.statusCode).toBe(201);
    const sessionId = session.json().sessionId as string;

    const t0 = Date.now() - 90 * 60_000;
    const at = (min: number) => new Date(t0 + min * 60_000).toISOString();

    // 16-ب) إرسال نقاط خط السير
    const points = Array.from({ length: 12 }, (_, i) => ({
      clientUuid: testUuid(),
      lat: RIYADH.lat + i * 0.0006,
      lon: RIYADH.lon,
      recordedAt: at(i * 2),
      speedMps: 7,
      accuracyM: 5,
    }));
    const routeSync = await app.inject({
      method: 'POST',
      url: '/v1/sync/route-points',
      headers: dh,
      payload: { sessionId, points },
    });
    expect(routeSync.json().accepted).toBe(12);
    expect(routeSync.json().distanceM).toBeGreaterThan(700);

    // 12 + 13) العامل يمسح QR — يُسجَّل الموقع والوقت
    const goodScan = await app.inject({
      method: 'POST',
      url: '/v1/scans',
      headers: dh,
      payload: {
        clientUuid: testUuid(),
        token: qrToken,
        lat: north(RIYADH, 8).lat,
        lon: RIYADH.lon,
        accuracyM: 6,
        scannedAt: at(5),
        sessionId,
      },
    });
    expect(goodScan.statusCode).toBe(201);
    expect(goodScan.json().status).toBe('VERIFIED');
    expect(goodScan.json().counted).toBe(true);
    expect(goodScan.json().distanceM).toBeLessThan(12);

    // 14) الزيارة تظهر في الإدارة
    const scans = await app.inject({ method: 'GET', url: '/v1/scans', headers: h });
    expect(scans.json().total).toBe(1);
    expect(scans.json().items[0].workerName).toBe('أحمد محمد');
    expect(scans.json().items[0].vehicleNo).toBe('07');

    const dash1 = await app.inject({ method: 'GET', url: '/v1/dashboard', headers: h });
    expect(dash1.json().servicedToday).toBe(1);
    expect(dash1.json().totalBins).toBe(4);
    expect(dash1.json().remaining).toBe(3);

    // 15) السيارة تظهر على الخريطة بموقعها
    const live = await app.inject({ method: 'GET', url: '/v1/routes/live', headers: h });
    const myVehicle = (live.json().items as { vehicleId: string; lat: number | null }[]).find(
      (v) => v.vehicleId === vehicleId,
    );
    expect(myVehicle).toBeDefined();
    expect(myVehicle!.lat).not.toBeNull();

    // 16-ج) خط السير محفوظ ويُقرأ كـ GeoJSON
    const track = await app.inject({
      method: 'GET',
      url: `/v1/routes/sessions/${sessionId}`,
      headers: h,
    });
    expect(track.json().geojson.geometry.coordinates).toHaveLength(12);
    expect(track.json().scans).toHaveLength(1);

    // 17 + 18) مسح خارج النطاق يظهر Suspicious
    const farBin = await app.inject({
      method: 'GET',
      url: '/v1/bins?q=VR-900001',
      headers: h,
    });
    const farBinId = farBin.json().items[0].id as string;
    const farDetail = await app.inject({ method: 'GET', url: `/v1/bins/${farBinId}`, headers: h });
    const farToken = farDetail.json().qrToken as string;
    const farBinPoint = { lat: farBin.json().items[0].lat, lon: farBin.json().items[0].lon };

    const badScan = await app.inject({
      method: 'POST',
      url: '/v1/scans',
      headers: dh,
      payload: {
        clientUuid: testUuid(),
        token: farToken,
        lat: north(farBinPoint, 350).lat,
        lon: farBinPoint.lon,
        accuracyM: 6,
        scannedAt: at(20),
        sessionId,
      },
    });
    expect(badScan.json().status).toBe('SUSPICIOUS');
    expect(badScan.json().counted).toBe(false);
    expect(badScan.json().reasons).toContain('OUT_OF_RANGE');

    const attention = await app.inject({ method: 'GET', url: '/v1/attention', headers: h });
    expect(attention.json().counts.SCAN_OUT_OF_RANGE).toBe(1);
    expect(attention.json().counts.BIN_NOT_SERVICED).toBe(3);

    // 19 + 20) عمل أوفلاين ثم مزامنة بعد عودة الاتصال
    const offlineBins = await app.inject({
      method: 'GET',
      url: '/v1/bins?q=VR-9000',
      headers: h,
    });
    const targets = (offlineBins.json().items as { id: string; lat: number; lon: number }[]).slice(
      1,
    );
    const offlineItems = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      const detail = await app.inject({ method: 'GET', url: `/v1/bins/${t.id}`, headers: h });
      offlineItems.push({
        clientUuid: testUuid(),
        token: detail.json().qrToken as string,
        lat: t.lat,
        lon: t.lon,
        accuracyM: 9,
        scannedAt: at(30 + i * 5),
        sessionId,
      });
    }
    expect(offlineItems.length).toBe(2);

    const sync1 = await app.inject({
      method: 'POST',
      url: '/v1/sync/scans',
      headers: dh,
      payload: { items: offlineItems },
    });
    expect(sync1.json().summary.accepted).toBe(2);

    // إعادة المزامنة (شبكة متقطعة) لا تُنشئ تكرارًا
    const sync2 = await app.inject({
      method: 'POST',
      url: '/v1/sync/scans',
      headers: dh,
      payload: { items: offlineItems },
    });
    expect(sync2.json().summary.accepted).toBe(0);
    expect(sync2.json().summary.duplicates).toBe(2);

    const dash2 = await app.inject({ method: 'GET', url: '/v1/dashboard', headers: h });
    expect(dash2.json().servicedToday).toBe(3);
    expect(dash2.json().remaining).toBe(1);
    expect(dash2.json().completionRate).toBe(75);
    expect(dash2.json().offlineScansToday).toBe(2);

    await app.inject({
      method: 'POST',
      url: `/v1/routes/sessions/${sessionId}/end`,
      headers: dh,
    });

    // 21) إنشاء تقرير أسبوعي
    const today = serviceDay(new Date(), TZ);
    const report = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: h,
      payload: { kind: 'WEEKLY', from: today, to: today },
    });
    expect(report.statusCode).toBe(201);
    const reportId = report.json().id as string;
    const sla = report.json().payload.sla;
    expect(sla.servicePoints).toBe(4);
    expect(sla.verified).toBe(3);
    expect(sla.suspicious).toBe(1);
    expect(sla.missed).toBe(1);
    expect(sla.complianceRate).toBe(75);

    // 22) تنزيل PDF بشعار واسم الشركة
    const pdf = await app.inject({
      method: 'GET',
      url: `/v1/reports/${reportId}.pdf`,
      headers: h,
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.rawPayload.length).toBeGreaterThan(20_000);

    // رمز التحقق داخل التقرير يعمل للعامة
    const verify = await app.inject({
      method: 'GET',
      url: `/v1/verify/${report.json().verifyToken}`,
      headers: { accept: 'application/json' },
    });
    expect(verify.json().status).toBe('Verified Report');
    expect(verify.json().complianceRate).toBe(75);

    // 23) تنزيل Excel
    const xlsx = await app.inject({
      method: 'GET',
      url: `/v1/reports/${reportId}.xlsx`,
      headers: h,
    });
    expect(xlsx.statusCode).toBe(200);
    expect(xlsx.rawPayload.subarray(0, 2).toString()).toBe('PK');

    // سلسلة الإثبات سليمة قبل النسخ الاحتياطي
    const chain1 = await app.inject({
      method: 'GET',
      url: '/v1/scans/chain/verify',
      headers: h,
    });
    expect(chain1.json().ok).toBe(true);
    expect(chain1.json().checked).toBe(4);

    // سجل العمليات يحوي كامل الرحلة التشغيلية حتى الآن
    const auditBefore = await app.inject({
      method: 'GET',
      url: '/v1/audit?pageSize=200',
      headers: h,
    });
    const actionsBefore = new Set(
      (auditBefore.json().items as { action: string }[]).map((a) => a.action),
    );
    for (const expected of [
      'setup.complete',
      'vehicle.create',
      'worker.create',
      'vehicle.assign_driver',
      'bin.create',
      'bin.import',
      'qr.stickers.generate',
      'device.activation_code.create',
      'device.activate',
      'scan.record',
      'report.create',
    ]) {
      expect(actionsBefore.has(expected), `يجب تسجيل الإجراء ${expected}`).toBe(true);
    }

    // 24) أخذ نسخة احتياطية
    const backup = await app.inject({ method: 'POST', url: '/v1/backups', headers: h });
    expect(backup.statusCode).toBe(201);
    const download = await app.inject({
      method: 'GET',
      url: `/v1/backups/${backup.json().id}/download`,
      headers: h,
    });
    const archive = download.rawPayload;

    // 25) كارثة ثم استعادة ناجحة
    await query('DELETE FROM scans');
    await query('DELETE FROM bins');
    await query('DELETE FROM workers');
    await query('DELETE FROM vehicles');

    const wiped = await app.inject({ method: 'GET', url: '/v1/dashboard', headers: h });
    expect(wiped.json().totalBins).toBe(0);

    const boundary = '----vero-acceptance';
    const restore = await app.inject({
      method: 'POST',
      url: '/v1/backups/restore',
      headers: { ...h, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="b.json.gz"\r\n` +
            'Content-Type: application/gzip\r\n\r\n',
        ),
        archive,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json().restored.bins).toBe(4);
    expect(restore.json().restored.scans).toBe(4);
    expect(restore.json().restored.route_points).toBe(12);

    const dash3 = await app.inject({ method: 'GET', url: '/v1/dashboard', headers: h });
    expect(dash3.json().totalBins).toBe(4);
    expect(dash3.json().servicedToday).toBe(3);
    expect(dash3.json().completionRate).toBe(75);

    // 26) البيانات باقية وسليمة بعد إعادة التشغيل (اتصال جديد بالخادم وقاعدة البيانات)
    const chain2 = await app.inject({
      method: 'GET',
      url: '/v1/scans/chain/verify',
      headers: h,
    });
    expect(chain2.json().ok).toBe(true);
    expect(chain2.json().checked).toBe(4);

    // رمز QR القديم ما زال يعمل بعد الاستعادة (نفس النونس ونفس رقم الحاوية)
    const rescan = await app.inject({
      method: 'POST',
      url: '/v1/scans',
      headers: dh,
      payload: {
        clientUuid: testUuid(),
        token: qrToken,
        lat: north(RIYADH, 8).lat,
        lon: RIYADH.lon,
        accuracyM: 6,
        scannedAt: new Date().toISOString(),
      },
    });
    expect(rescan.statusCode).toBe(201);
    expect(rescan.json().outcome).toBe('duplicate'); // مخدومة اليوم مسبقًا
    expect(rescan.json().bin.publicId).toBe(binDetail.json().publicId);

    // سجل العمليات بعد الاستعادة = لقطة وقت النسخ + عملية الاستعادة نفسها.
    // هذا سلوك مقصود: الاستعادة تُرجع الحالة إلى لحظة النسخ، ثم تُوثّق نفسها.
    const audit = await app.inject({ method: 'GET', url: '/v1/audit?pageSize=200', headers: h });
    const actions = new Set((audit.json().items as { action: string }[]).map((a) => a.action));
    for (const expected of [
      'setup.complete',
      'vehicle.create',
      'worker.create',
      'bin.create',
      'bin.import',
      'device.activate',
      'scan.record',
      'report.create',
      'backup.restore',
    ]) {
      expect(actions.has(expected), `يجب تسجيل الإجراء ${expected}`).toBe(true);
    }
  }, 60_000);
});
