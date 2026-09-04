import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, one } from '../src/db/pool.js';
import { serviceDay } from '../src/core/time.js';
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
const TZ = 'Asia/Riyadh';

let w: TestWorld;
let dev: Awaited<ReturnType<typeof setupDevice>>;
let bins: Awaited<ReturnType<typeof createBin>>[];
let today: string;

beforeAll(async () => {
  w = await freshWorld({ timezone: TZ });
  dev = await setupDevice(w);
  today = serviceDay(new Date(), TZ);

  // 5 حاويات: 3 تُخدَم بشكل سليم، 1 مشبوهة، 1 لا تُخدَم إطلاقًا
  bins = [];
  for (let i = 0; i < 5; i++) {
    bins.push(
      await createBin(w, {
        ...offsetMeters(RIYADH, 0, i * 300),
        publicId: `VR-R${String(i + 1).padStart(5, '0')}`,
        sector: i < 3 ? 'القطاع الأول' : 'القطاع الثاني',
      }),
    );
  }

  const base = Date.now() - 3 * 3600_000;
  const scanAt = (i: number) => new Date(base + i * 5 * 60_000).toISOString();

  for (let i = 0; i < 3; i++) {
    await w.app.inject({
      method: 'POST',
      url: '/v1/scans',
      headers: deviceHeader(dev.deviceToken),
      payload: {
        clientUuid: testUuid(),
        token: bins[i]!.qrToken,
        lat: bins[i]!.lat,
        lon: bins[i]!.lon,
        accuracyM: 7,
        scannedAt: scanAt(i),
      },
    });
  }

  // زيارة مشبوهة (خارج النطاق) للحاوية الرابعة
  const far = offsetMeters({ lat: bins[3]!.lat, lon: bins[3]!.lon }, 400);
  await w.app.inject({
    method: 'POST',
    url: '/v1/scans',
    headers: deviceHeader(dev.deviceToken),
    payload: {
      clientUuid: testUuid(),
      token: bins[3]!.qrToken,
      lat: far.lat,
      lon: far.lon,
      accuracyM: 7,
      scannedAt: scanAt(10),
    },
  });
});

afterAll(async () => {
  await closeApp();
  await closePool();
});

describe('لوحة المعلومات و«تحتاج انتباه»', () => {
  it('الأرقام تطابق الواقع في قاعدة البيانات', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/dashboard',
      headers: authHeader(w.accessToken),
    });
    const d = res.json();
    expect(d.totalBins).toBe(5);
    expect(d.activeBins).toBe(5);
    expect(d.servicedToday).toBe(3);
    expect(d.remaining).toBe(2);
    expect(d.completionRate).toBe(60);
    expect(d.needsReview).toBe(1);
    expect(d.suspiciousToday).toBe(1);
  });

  it('«تحتاج انتباه» يعرض الاستثناءات فقط', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/attention',
      headers: authHeader(w.accessToken),
    });
    const body = res.json();
    expect(body.counts.BIN_NOT_SERVICED).toBe(2);
    expect(body.counts.SCAN_OUT_OF_RANGE).toBe(1);
    const first = body.items[0] as { severity: string };
    expect(first.severity).toBe('HIGH');
  });

  it('الخريطة تعطي حالة كل حاوية', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/bins/map',
      headers: authHeader(w.accessToken),
    });
    const items = res.json().items as { state: string; lat: number; lon: number }[];
    expect(items).toHaveLength(5);
    expect(items.filter((i) => i.state === 'DONE')).toHaveLength(3);
    expect(items.filter((i) => i.state === 'REVIEW')).toHaveLength(1);
    expect(items.filter((i) => i.state === 'PENDING')).toHaveLength(1);
    for (const i of items) {
      expect(i.lat).toBeGreaterThan(24);
      expect(i.lon).toBeGreaterThan(46);
    }
  });
});

describe('حساب SLA والتقارير', () => {
  it('يحسب نسبة الالتزام بزيارة واحدة يوميًا', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: authHeader(w.accessToken),
      payload: { kind: 'DAILY', from: today, to: today },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    const sla = r.payload.sla;

    expect(sla.servicePoints).toBe(5);
    expect(sla.requiredVisitsPerDay).toBe(1);
    expect(sla.requiredVisits).toBe(5);
    expect(sla.verified).toBe(3);
    expect(sla.suspicious).toBe(1);
    expect(sla.missed).toBe(2);
    expect(sla.complianceRate).toBe(60);
    expect(r.reportNo).toMatch(/^VR-R-\d{4}-\d{5}$/);
    expect(r.verifyToken).toBeTruthy();
  });

  it('عقد SLA بزيارتين يوميًا يضاعف المطلوب', async () => {
    const contract = await w.app.inject({
      method: 'POST',
      url: '/v1/sla-contracts',
      headers: authHeader(w.accessToken),
      payload: {
        name: 'عقد أمانة الرياض',
        clientName: 'أمانة منطقة الرياض',
        requiredVisitsPerDay: 2,
        activeFrom: today,
      },
    });
    expect(contract.statusCode).toBe(201);

    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: authHeader(w.accessToken),
      payload: {
        kind: 'DAILY',
        from: today,
        to: today,
        slaContractId: contract.json().id,
      },
    });
    const sla = res.json().payload.sla;
    expect(sla.requiredVisitsPerDay).toBe(2);
    expect(sla.requiredVisits).toBe(10);
    expect(sla.missed).toBe(7); // 10 مطلوبة - 3 منفَّذة
    expect(sla.complianceRate).toBe(30);
    expect(sla.contractName).toBe('عقد أمانة الرياض');
  });

  it('عقد محدود بقطاع يحسب نقاط ذلك القطاع فقط', async () => {
    const contract = await w.app.inject({
      method: 'POST',
      url: '/v1/sla-contracts',
      headers: authHeader(w.accessToken),
      payload: {
        name: 'عقد القطاع الثاني',
        requiredVisitsPerDay: 1,
        scopeSector: 'القطاع الثاني',
        activeFrom: today,
      },
    });
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: authHeader(w.accessToken),
      payload: {
        kind: 'DAILY',
        from: today,
        to: today,
        slaContractId: contract.json().id,
      },
    });
    const sla = res.json().payload.sla;
    expect(sla.servicePoints).toBe(2); // حاويتان فقط في القطاع الثاني
    expect(sla.verified).toBe(0);
    expect(sla.missed).toBe(2);
  });

  it('التقرير يفصّل الأداء حسب السيارة والعامل والقطاع واليوم', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: authHeader(w.accessToken),
      payload: { kind: 'DAILY', from: today, to: today },
    });
    const p = res.json().payload;
    expect(p.byVehicle.length).toBeGreaterThan(0);
    expect(p.byWorker.length).toBeGreaterThan(0);
    expect(p.bySector.length).toBe(2);
    expect(p.byDay.length).toBe(1);
    expect(p.byDay[0].required).toBe(5);
    expect(p.exceptions.binsNeverServiced).toHaveLength(2);
    expect(p.exceptions.suspiciousScans).toHaveLength(1);
    expect(p.exceptions.suspiciousScans[0].reasons).toContain('OUT_OF_RANGE');
  });

  it('يرفض فترة مقلوبة', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: authHeader(w.accessToken),
      payload: { kind: 'CUSTOM', from: '2026-02-10', to: '2026-02-01' },
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('مخرجات التقرير', () => {
  let reportId: string;
  let verifyToken: string;

  beforeAll(async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: authHeader(w.accessToken),
      payload: { kind: 'WEEKLY', from: today, to: today },
    });
    reportId = res.json().id;
    verifyToken = res.json().verifyToken;
  });

  it('ينتج PDF صالحًا بحجم معقول', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: `/v1/reports/${reportId}.pdf`,
      headers: authHeader(w.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const buf = res.rawPayload;
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(20_000); // يحوي خطوطًا عربية مضمّنة
    expect(buf.subarray(buf.length - 10).toString()).toContain('EOF');
  });

  it('ينتج Excel صالحًا بكل الأوراق', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: `/v1/reports/${reportId}.xlsx`,
      headers: authHeader(w.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const buf = res.rawPayload;
    expect(buf.subarray(0, 2).toString()).toBe('PK'); // ZIP

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const names = wb.worksheets.map((s) => s.name);
    expect(names).toContain('الملخص');
    expect(names).toContain('السيارات');
    expect(names).toContain('نقاط لم تُخدَم');

    const missed = wb.getWorksheet('نقاط لم تُخدَم')!;
    expect(missed.rowCount).toBe(3); // ترويسة + حاويتان
  });

  it('رابط التحقق العام يعمل بلا مصادقة ولا يكشف بيانات تشغيلية', async () => {
    const json = await w.app.inject({
      method: 'GET',
      url: `/v1/verify/${verifyToken}`,
      headers: { accept: 'application/json' },
    });
    expect(json.statusCode).toBe(200);
    const v = json.json();
    expect(v.status).toBe('Verified Report');
    expect(v.companyName).toBe('شركة النظافة المتحدة');
    expect(v.complianceRate).toBe(60);

    const raw = JSON.stringify(v);
    expect(raw).not.toContain('VR-R00001'); // لا أرقام حاويات
    expect(raw).not.toContain('أحمد محمد'); // لا أسماء عمال
    expect(raw).not.toContain('24.71'); // لا إحداثيات

    const html = await w.app.inject({ method: 'GET', url: `/v1/verify/${verifyToken}` });
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.body).toContain('Verified Report');
  });

  it('رمز تحقق غير معروف يرجع 404', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/verify/nonexistent-token-value',
      headers: { accept: 'application/json' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('مركز QR', () => {
  it('يلخّص حالة الرموز', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/qr/summary',
      headers: authHeader(w.accessToken),
    });
    const s = res.json();
    expect(s.totalBins).toBe(5);
    expect(s.generated).toBe(5);
    expect(s.missing).toBe(0);
    expect(s.notPrinted).toBe(5);
  });

  it('ينتج ملصقات PDF لكل الحاويات ويعلّمها مطبوعة', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/qr/stickers',
      headers: authHeader(w.accessToken),
      payload: { all: true, markPrinted: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['x-vero-sticker-count']).toBe('5');
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');

    const summary = await w.app.inject({
      method: 'GET',
      url: '/v1/qr/summary',
      headers: authHeader(w.accessToken),
    });
    expect(summary.json().printed).toBe(5);
    expect(summary.json().notPrinted).toBe(0);
  });

  it('ينتج ملصقات لقطاع محدد فقط', async () => {
    const res = await w.app.inject({
      method: 'POST',
      url: '/v1/qr/stickers',
      headers: authHeader(w.accessToken),
      payload: { sector: 'القطاع الثاني' },
    });
    expect(res.headers['x-vero-sticker-count']).toBe('2');
  });

  it('إعادة الطباعة تُبقي نفس الرمز ونفس رقم الحاوية', async () => {
    const before = await w.app.inject({
      method: 'GET',
      url: `/v1/bins/${bins[0]!.id}`,
      headers: authHeader(w.accessToken),
    });
    await w.app.inject({
      method: 'POST',
      url: '/v1/qr/stickers',
      headers: authHeader(w.accessToken),
      payload: { binIds: [bins[0]!.id] },
    });
    const after = await w.app.inject({
      method: 'GET',
      url: `/v1/bins/${bins[0]!.id}`,
      headers: authHeader(w.accessToken),
    });
    expect(after.json().qrToken).toBe(before.json().qrToken);
    expect(after.json().publicId).toBe(before.json().publicId);
  });

  it('ينتج صورة QR PNG لحاوية', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: `/v1/qr/bin/${bins[0]!.id}.png`,
      headers: authHeader(w.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.rawPayload.subarray(1, 4).toString()).toBe('PNG');
  });

  it('ينتج ورقة تفعيل PDF', async () => {
    const codes = await w.app.inject({
      method: 'GET',
      url: '/v1/devices/activation-codes',
      headers: authHeader(w.accessToken),
    });
    const id = codes.json().items[0].id as string;
    const res = await w.app.inject({
      method: 'GET',
      url: `/v1/devices/activation-codes/${id}.pdf`,
      headers: authHeader(w.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('النسخ الاحتياطي والاستعادة', () => {
  it('ينشئ نسخة ويستعيدها بالكامل بعد مسح البيانات', async () => {
    const created = await w.app.inject({
      method: 'POST',
      url: '/v1/backups',
      headers: authHeader(w.accessToken),
    });
    expect(created.statusCode).toBe(201);
    const backupId = created.json().id as string;
    expect(created.json().sizeBytes).toBeGreaterThan(100);

    const download = await w.app.inject({
      method: 'GET',
      url: `/v1/backups/${backupId}/download`,
      headers: authHeader(w.accessToken),
    });
    expect(download.statusCode).toBe(200);
    const archive = download.rawPayload;
    expect(archive[0]).toBe(0x1f); // gzip magic
    expect(archive[1]).toBe(0x8b);

    // الحالة قبل الكارثة
    const before = await w.app.inject({
      method: 'GET',
      url: '/v1/dashboard',
      headers: authHeader(w.accessToken),
    });
    const beforeStats = before.json();
    const beforeChain = await w.app.inject({
      method: 'GET',
      url: '/v1/scans/chain/verify',
      headers: authHeader(w.accessToken),
    });
    expect(beforeChain.json().ok).toBe(true);

    // كارثة: حذف كل الحاويات (يحذف زياراتها تتابعيًا)
    const { query } = await import('../src/db/pool.js');
    await query('DELETE FROM bins');
    const wiped = await w.app.inject({
      method: 'GET',
      url: '/v1/dashboard',
      headers: authHeader(w.accessToken),
    });
    expect(wiped.json().totalBins).toBe(0);

    // الاستعادة
    const boundary = '----vero-test-boundary';
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="backup.json.gz"\r\n` +
        `Content-Type: application/gzip\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const restore = await w.app.inject({
      method: 'POST',
      url: '/v1/backups/restore',
      headers: {
        ...authHeader(w.accessToken),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.concat([head, archive, tail]),
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json().restored.bins).toBe(5);
    expect(restore.json().companyName).toBe('شركة النظافة المتحدة');

    // بعد الاستعادة: كل شيء كما كان
    const after = await w.app.inject({
      method: 'GET',
      url: '/v1/dashboard',
      headers: authHeader(w.accessToken),
    });
    expect(after.json().totalBins).toBe(beforeStats.totalBins);
    expect(after.json().servicedToday).toBe(beforeStats.servicedToday);
    expect(after.json().completionRate).toBe(beforeStats.completionRate);

    // والأهم: سلسلة الإثبات ما زالت سليمة بعد الاستعادة
    const afterChain = await w.app.inject({
      method: 'GET',
      url: '/v1/scans/chain/verify',
      headers: authHeader(w.accessToken),
    });
    expect(afterChain.json().ok).toBe(true);
    expect(afterChain.json().checked).toBe(beforeChain.json().checked);
  });

  it('المواقع الجغرافية تُستعاد بدقة', async () => {
    const row = await one<{ lat: number; lon: number }>(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
         FROM bins WHERE upper(public_id) = 'VR-R00001'`,
    );
    expect(row).not.toBeNull();
    expect(row!.lat).toBeCloseTo(RIYADH.lat, 6);
    expect(row!.lon).toBeCloseTo(RIYADH.lon, 6);
  });

  it('يرفض ملفًا ليس نسخة VERO', async () => {
    const { parseBackup } = await import('../src/modules/backups/service.js');
    expect(() => parseBackup(Buffer.from('{"format":"something-else"}'))).toThrow(
      /ليس نسخة احتياطية/,
    );
    expect(() => parseBackup(Buffer.from('not json at all'))).toThrow();
  });

  it('رموز QR تبقى صالحة بعد الاستعادة', async () => {
    const detail = await w.app.inject({
      method: 'GET',
      url: `/v1/bins/${bins[0]!.id}`,
      headers: authHeader(w.accessToken),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().qrToken).toBe(bins[0]!.qrToken);
  });
});
