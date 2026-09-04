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
  w = await freshWorld({ defaultGpsRadiusM: 30 });
  dev = await setupDevice(w);
});

afterAll(async () => {
  await closeApp();
  await closePool();
});

/**
 * ساعة اختبار واقعية: كل مسح يبعد دقيقتين عن سابقه داخل اليوم نفسه.
 * بدونها تقع كل عمليات المسح في نفس الجزء من الثانية، فيتحول التنقل بين
 * حاويتين متباعدتين إلى «سرعة مستحيلة» ويفسد الاختبارات لسبب مصطنع.
 */
let clockCursor = 0;
function nextScanTime(): string {
  if (clockCursor === 0) {
    const now = Date.now();
    const localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0);
    // نبدأ قبل ساعة، على ألا نتجاوز منتصف الليل المحلي إلى اليوم السابق
    clockCursor = Math.max(localMidnight.getTime() + 60_000, now - 60 * 60_000);
  }
  clockCursor += 120_000;
  return new Date(Math.min(clockCursor, Date.now() - 1000)).toISOString();
}

async function scan(
  token: string,
  point: { lat: number; lon: number },
  extra: Record<string, unknown> = {},
) {
  return w.app.inject({
    method: 'POST',
    url: '/v1/scans',
    headers: deviceHeader(dev.deviceToken),
    payload: {
      clientUuid: testUuid(),
      token,
      lat: point.lat,
      lon: point.lon,
      accuracyM: 8,
      scannedAt: nextScanTime(),
      ...extra,
    },
  });
}

describe('نطاق GPS وحالة الزيارة', () => {
  it('مسح داخل النطاق يُوثَّق ويُحتسب', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100001' });
    const res = await scan(bin.qrToken, offsetMeters(RIYADH, 10));

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('VERIFIED');
    expect(body.counted).toBe(true);
    expect(body.outcome).toBe('accepted');
    expect(body.distanceM).toBeLessThan(15);
    expect(body.reasons).toEqual([]);
    expect(body.bin.publicId).toBe('VR-100001');
  });

  it('مسح خارج النطاق يُحفَظ كمشبوه ولا يُحتسب', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100002' });
    const res = await scan(bin.qrToken, offsetMeters(RIYADH, 250));

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('SUSPICIOUS');
    expect(body.counted).toBe(false);
    expect(body.reasons).toContain('OUT_OF_RANGE');
    expect(body.distanceM).toBeGreaterThan(200);
  });

  it('يحترم النطاق المخصّص لكل حاوية', async () => {
    const wide = await createBin(w, {
      ...RIYADH,
      publicId: 'VR-100003',
      gpsRadiusM: 500,
    });
    const res = await scan(wide.qrToken, offsetMeters(RIYADH, 250));
    expect(res.json().status).toBe('VERIFIED');
    expect(res.json().radiusM).toBe(500);
  });

  it('دقة GPS الضعيفة تجعل الزيارة مشبوهة رغم القرب', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100004' });
    const res = await scan(bin.qrToken, offsetMeters(RIYADH, 5), { accuracyM: 350 });
    const body = res.json();
    expect(body.status).toBe('SUSPICIOUS');
    expect(body.reasons).toContain('LOW_GPS_ACCURACY');
  });

  it('انتقال مستحيل بين مسحين يُعلَّم كاشتباه', async () => {
    const near = await createBin(w, { ...RIYADH, publicId: 'VR-100006' });
    const farPoint = offsetMeters(RIYADH, 0, 30_000); // 30 كم شرقًا
    const far = await createBin(w, { ...farPoint, publicId: 'VR-100007' });

    const t0 = new Date(Date.now() - 10 * 60_000);
    const t1 = new Date(t0.getTime() + 60_000); // بعد دقيقة واحدة فقط

    const first = await scan(near.qrToken, RIYADH, { scannedAt: t0.toISOString() });
    expect(first.json().status).toBe('VERIFIED');

    // 30 كم في 60 ثانية = 500 م/ث — مستحيل
    const second = await scan(far.qrToken, farPoint, { scannedAt: t1.toISOString() });
    expect(second.json().reasons).toContain('IMPLAUSIBLE_SPEED');
    expect(second.json().status).toBe('SUSPICIOUS');
  });

  it('حاويتان متجاورتان خلال ثوانٍ لا تُعدّان تلاعبًا', async () => {
    const a = await createBin(w, { ...RIYADH, publicId: 'VR-100008' });
    const nextDoor = offsetMeters(RIYADH, 0, 25);
    const b = await createBin(w, { ...nextDoor, publicId: 'VR-100009' });

    const t0 = new Date(Date.now() - 5 * 60_000);
    await scan(a.qrToken, RIYADH, { scannedAt: t0.toISOString() });
    const second = await scan(b.qrToken, nextDoor, {
      scannedAt: new Date(t0.getTime() + 8_000).toISOString(),
    });
    expect(second.json().reasons).not.toContain('IMPLAUSIBLE_SPEED');
    expect(second.json().status).toBe('VERIFIED');
  });

  it('وقت مسح مستقبلي يُعلَّم', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100005' });
    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    const res = await scan(bin.qrToken, offsetMeters(RIYADH, 5), { scannedAt: future });
    expect(res.json().reasons).toContain('FUTURE_TIMESTAMP');
  });
});

describe('صلاحية رمز QR', () => {
  it('يرفض رمزًا غير صادر عن النظام', async () => {
    const res = await scan('vero1.VR-100001.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb', RIYADH);
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.outcome).toBe('rejected');
    expect(body.reasons).toContain('TOKEN_BAD_SIGNATURE');
  });

  it('يرفض رمزًا مشوّهًا', async () => {
    const res = await scan('not-a-vero-token', RIYADH);
    expect(res.statusCode).toBe(422);
    expect(res.json().reasons).toContain('TOKEN_MALFORMED');
  });

  it('يرفض حاوية معطّلة', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100010' });
    await w.app.inject({
      method: 'PATCH',
      url: `/v1/bins/${bin.id}`,
      headers: authHeader(w.accessToken),
      payload: { status: 'DISABLED' },
    });
    const res = await scan(bin.qrToken, RIYADH);
    expect(res.statusCode).toBe(422);
    expect(res.json().reasons).toContain('BIN_DISABLED');
  });

  it('يرفض رمزًا أُعيد توليده (الرمز القديم يصبح ملغى)', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100011' });
    const oldToken = bin.qrToken;

    const regen = await w.app.inject({
      method: 'POST',
      url: `/v1/qr/bin/${bin.id}/regenerate`,
      headers: authHeader(w.accessToken),
    });
    expect(regen.statusCode).toBe(200);
    const newToken = regen.json().token as string;
    expect(newToken).not.toBe(oldToken);

    const oldRes = await scan(oldToken, RIYADH);
    expect(oldRes.statusCode).toBe(422);
    expect(oldRes.json().reasons).toContain('TOKEN_REVOKED');

    const newRes = await scan(newToken, RIYADH);
    expect(newRes.json().status).toBe('VERIFIED');
  });

  it('يسجّل كل محاولة فاشلة في سجل المحاولات', async () => {
    const before = await w.app.inject({
      method: 'GET',
      url: '/v1/attention',
      headers: authHeader(w.accessToken),
    });
    const beforeCount = before.json().counts.INVALID_TOKEN_ATTEMPT ?? 0;

    await scan('vero1.VR-999999.xxxxxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyy', RIYADH);

    const after = await w.app.inject({
      method: 'GET',
      url: '/v1/attention',
      headers: authHeader(w.accessToken),
    });
    expect(after.json().counts.INVALID_TOKEN_ATTEMPT).toBeGreaterThan(beforeCount);
  });
});

describe('منع التكرار اليومي', () => {
  it('خمس عمليات مسح لنفس الحاوية = زيارة معتمدة واحدة', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100020' });

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push((await scan(bin.qrToken, offsetMeters(RIYADH, 5))).json());
    }

    const counted = results.filter((r) => r.counted);
    expect(counted).toHaveLength(1);
    expect(results[0]!.outcome).toBe('accepted');
    for (let i = 1; i < 5; i++) expect(results[i]!.outcome).toBe('duplicate');

    // كل المحاولات محفوظة رغم ذلك
    const list = await w.app.inject({
      method: 'GET',
      url: `/v1/scans?binId=${bin.id}`,
      headers: authHeader(w.accessToken),
    });
    expect(list.json().total).toBe(5);
  });

  it('يوم جديد يعيد الحاوية إلى «لم تتم خدمتها» مع بقاء التاريخ', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100021' });

    const yesterday = new Date(Date.now() - 26 * 3600_000).toISOString();
    const r1 = await scan(bin.qrToken, offsetMeters(RIYADH, 5), { scannedAt: yesterday });
    expect(r1.json().counted).toBe(true);

    const r2 = await scan(bin.qrToken, offsetMeters(RIYADH, 5));
    expect(r2.json().counted).toBe(true);
    expect(r2.json().serviceDay).not.toBe(r1.json().serviceDay);

    const list = await w.app.inject({
      method: 'GET',
      url: `/v1/scans?binId=${bin.id}&countedOnly=true`,
      headers: authHeader(w.accessToken),
    });
    expect(list.json().total).toBe(2); // كلا اليومين محفوظان
  });

  it('نفس clientUuid لا يُنشئ سجلًا مكرّرًا (Idempotency)', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100022' });
    const clientUuid = testUuid();
    const payload = {
      clientUuid,
      token: bin.qrToken,
      lat: RIYADH.lat,
      lon: RIYADH.lon,
      accuracyM: 6,
      scannedAt: new Date().toISOString(),
    };

    const first = await w.app.inject({
      method: 'POST',
      url: '/v1/scans',
      headers: deviceHeader(dev.deviceToken),
      payload,
    });
    const second = await w.app.inject({
      method: 'POST',
      url: '/v1/scans',
      headers: deviceHeader(dev.deviceToken),
      payload,
    });

    expect(first.json().outcome).toBe('accepted');
    expect(second.json().outcome).toBe('duplicate');
    expect(second.json().scanId).toBe(first.json().scanId);

    const list = await w.app.inject({
      method: 'GET',
      url: `/v1/scans?binId=${bin.id}`,
      headers: authHeader(w.accessToken),
    });
    expect(list.json().total).toBe(1);
  });
});

describe('مراجعة الإدارة للزيارات المشبوهة', () => {
  it('قبول زيارة مشبوهة يحتسبها زيارة اليوم', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100030' });
    const res = await scan(bin.qrToken, offsetMeters(RIYADH, 400));
    const scanId = res.json().scanId as string;
    expect(res.json().counted).toBe(false);
    expect(res.json().status).toBe('SUSPICIOUS');

    const review = await w.app.inject({
      method: 'POST',
      url: `/v1/scans/${scanId}/review`,
      headers: authHeader(w.accessToken),
      payload: { reviewStatus: 'ACCEPTED', note: 'تم التأكد ميدانيًا' },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json().counted).toBe(true);
    expect(review.json().reviewStatus).toBe('ACCEPTED');
  });

  it('رفض زيارة مشبوهة يمنع احتسابها', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100031' });
    const res = await scan(bin.qrToken, offsetMeters(RIYADH, 400));
    const scanId = res.json().scanId as string;

    const review = await w.app.inject({
      method: 'POST',
      url: `/v1/scans/${scanId}/review`,
      headers: authHeader(w.accessToken),
      payload: { reviewStatus: 'REJECTED', note: 'خارج الموقع' },
    });
    expect(review.json().counted).toBe(false);
    expect(review.json().reviewStatus).toBe('REJECTED');
  });

  it('لا يقبل زيارة مشبوهة إذا كانت الحاوية مخدومة أصلًا في نفس اليوم', async () => {
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100032' });
    await scan(bin.qrToken, offsetMeters(RIYADH, 5)); // زيارة معتمدة
    const susp = await scan(bin.qrToken, offsetMeters(RIYADH, 400));
    const scanId = susp.json().scanId as string;

    const review = await w.app.inject({
      method: 'POST',
      url: `/v1/scans/${scanId}/review`,
      headers: authHeader(w.accessToken),
      payload: { reviewStatus: 'ACCEPTED' },
    });
    expect(review.json().counted).toBe(false); // لا ازدواج في العدّ
  });
});

describe('سلسلة الإثبات (Proof Chain)', () => {
  it('السلسلة سليمة بعد عمليات متعددة', async () => {
    const res = await w.app.inject({
      method: 'GET',
      url: '/v1/scans/chain/verify',
      headers: authHeader(w.accessToken),
    });
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.checked).toBeGreaterThan(5);
    expect(body.brokenAt).toEqual([]);
  });

  it('يكتشف العبث المباشر بقاعدة البيانات', async () => {
    const { query } = await import('../src/db/pool.js');
    const bin = await createBin(w, { ...RIYADH, publicId: 'VR-100040' });
    const res = await scan(bin.qrToken, offsetMeters(RIYADH, 5));
    const scanId = res.json().scanId as string;

    // تعديل يدوي على الموقع كما لو أن أحدهم عدّل قاعدة البيانات
    await query(
      `UPDATE scans SET location = ST_SetSRID(ST_MakePoint($2,$3),4326)::geography WHERE id = $1`,
      [scanId, RIYADH.lon + 0.05, RIYADH.lat + 0.05],
    );

    const verify = await w.app.inject({
      method: 'GET',
      url: '/v1/scans/chain/verify',
      headers: authHeader(w.accessToken),
    });
    const body = verify.json();
    expect(body.ok).toBe(false);
    expect(body.brokenAt.some((b: { scanId: string }) => b.scanId === scanId)).toBe(true);
  });
});
