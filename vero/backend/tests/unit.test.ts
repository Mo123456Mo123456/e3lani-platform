import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FONT_BOLD, FONT_REGULAR } from '../src/core/pdf.js';
import { ar, bidiReorder, hasArabic, shapeArabic } from '../src/core/arabic.js';
import { distanceMeters, impliedSpeedMps, isValidLatLon } from '../src/core/geo.js';
import { buildQrToken, newNonce, parseQrToken } from '../src/core/qr-token.js';
import { addDays, dayRange, daysBetweenInclusive, serviceDay } from '../src/core/time.js';
import { hashPassword, signJwt, verifyJwt, verifyPassword } from '../src/core/crypto.js';
import { normalizeActivationCode } from '../src/modules/devices/service.js';
import { parseBinsCsv } from '../src/modules/bins/service.js';
import { AppError } from '../src/core/errors.js';

describe('رموز QR الموقّعة', () => {
  it('يبني رمزًا ويقرؤه بنجاح', () => {
    const nonce = newNonce();
    const token = buildQrToken('VR-000248', nonce);
    expect(token.startsWith('vero1.VR-000248.')).toBe(true);

    const parsed = parseQrToken(token);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.publicId).toBe('VR-000248');
      expect(parsed.value.nonce).toBe(nonce);
    }
  });

  it('يرفض رمزًا عُبث بتوقيعه', () => {
    const token = buildQrToken('VR-000248', newNonce());
    const tampered = `${token.slice(0, -3)}zzz`;
    const parsed = parseQrToken(tampered);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toBe('BAD_SIGNATURE');
  });

  it('يرفض رمزًا لحاوية أخرى بنفس النونس', () => {
    const nonce = newNonce();
    buildQrToken('VR-000001', nonce);
    const forged = `vero1.VR-000999.${nonce}.${buildQrToken('VR-000001', nonce).split('.')[3]}`;
    const parsed = parseQrToken(forged);
    expect(parsed.ok).toBe(false);
  });

  it('يرفض الصيغ غير الصالحة', () => {
    for (const bad of ['', 'abc', 'vero1.VR-1.nonce', 'vero2.VR-1.n.s', 'vero1...']) {
      expect(parseQrToken(bad).ok).toBe(false);
    }
  });

  it('لا يفرّق بين حالة الأحرف في رقم الحاوية', () => {
    const nonce = newNonce();
    const token = buildQrToken('vr-000248', nonce);
    const parsed = parseQrToken(token.replace('VR-000248', 'vr-000248'));
    expect(parsed.ok).toBe(true);
  });
});

describe('الحسابات الجغرافية', () => {
  const riyadh = { lat: 24.7136, lon: 46.6753 };

  it('المسافة بين نقطة ونفسها صفر', () => {
    expect(distanceMeters(riyadh, riyadh)).toBeCloseTo(0, 5);
  });

  it('يحسب إزاحة 100 متر شمالًا بدقة معقولة', () => {
    const north = { lat: riyadh.lat + 100 / 111_320, lon: riyadh.lon };
    expect(distanceMeters(riyadh, north)).toBeGreaterThan(98);
    expect(distanceMeters(riyadh, north)).toBeLessThan(102);
  });

  it('يتحقق من صلاحية الإحداثيات', () => {
    expect(isValidLatLon(riyadh)).toBe(true);
    expect(isValidLatLon({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidLatLon({ lat: 0, lon: 181 })).toBe(false);
    expect(isValidLatLon({ lat: Number.NaN, lon: 0 })).toBe(false);
    expect(isValidLatLon(null)).toBe(false);
  });

  it('يحسب السرعة الضمنية ويرفض الفارق الزمني غير الموجب', () => {
    const a = { point: riyadh, at: new Date('2026-01-01T00:00:00Z') };
    const b = {
      point: { lat: riyadh.lat + 1000 / 111_320, lon: riyadh.lon },
      at: new Date('2026-01-01T00:00:10Z'),
    };
    const speed = impliedSpeedMps(a, b);
    expect(speed).not.toBeNull();
    expect(speed!).toBeGreaterThan(95); // 1000م في 10ث
    expect(impliedSpeedMps(a, { ...a })).toBeNull();
  });
});

describe('يوم الخدمة بتوقيت الشركة', () => {
  it('يحسب اليوم بتوقيت الرياض لا بتوقيت السيرفر', () => {
    // 2026-03-10T21:30:00Z = 2026-03-11 00:30 بتوقيت الرياض (UTC+3)
    const at = new Date('2026-03-10T21:30:00Z');
    expect(serviceDay(at, 'Asia/Riyadh')).toBe('2026-03-11');
    expect(serviceDay(at, 'UTC')).toBe('2026-03-10');
  });

  it('يعالج حدود منتصف الليل', () => {
    expect(serviceDay(new Date('2026-03-10T20:59:59Z'), 'Asia/Riyadh')).toBe('2026-03-10');
    expect(serviceDay(new Date('2026-03-10T21:00:00Z'), 'Asia/Riyadh')).toBe('2026-03-11');
  });

  it('يحسب المدى الزمني', () => {
    expect(daysBetweenInclusive('2026-01-01', '2026-01-07')).toBe(7);
    expect(daysBetweenInclusive('2026-01-01', '2026-01-01')).toBe(1);
    expect(daysBetweenInclusive('2026-01-07', '2026-01-01')).toBe(0);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // سنة كبيسة
    expect(dayRange('2026-01-01', '2026-01-03')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
  });
});

describe('كلمات المرور والجلسات', () => {
  it('يجزّئ كلمة المرور ويتحقق منها', async () => {
    const { hash, salt } = await hashPassword('Admin#12345');
    expect(hash).not.toContain('Admin');
    expect(await verifyPassword('Admin#12345', hash, salt)).toBe(true);
    expect(await verifyPassword('wrong', hash, salt)).toBe(false);
  });

  it('يعطي ملحًا مختلفًا لكل كلمة مرور', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('يوقّع رمز الجلسة ويتحقق منه', () => {
    const token = signJwt({ sub: 'u1', cid: 'c1', role: 'ADMIN', typ: 'access' }, 60);
    const payload = verifyJwt(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('ADMIN');
  });

  it('يرفض رمزًا معدَّلًا أو منتهيًا', () => {
    const token = signJwt({ sub: 'u1', cid: 'c1', role: 'ADMIN', typ: 'access' }, 60);
    const parts = token.split('.');
    expect(() => verifyJwt(`${parts[0]}.${parts[1]}.badsig`)).toThrow(AppError);

    const expired = signJwt({ sub: 'u1', cid: 'c1', role: 'ADMIN', typ: 'access' }, -10);
    expect(() => verifyJwt(expired)).toThrow(/انتهت/);
  });

  it('يرفض ترقية الدور بتعديل الحمولة', () => {
    const token = signJwt({ sub: 'u1', cid: 'c1', role: 'VIEWER', typ: 'access' }, 60);
    const [h, , s] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        sub: 'u1',
        cid: 'c1',
        role: 'ADMIN',
        typ: 'access',
        iat: 0,
        exp: 9_999_999_999,
      }),
    ).toString('base64url');
    expect(() => verifyJwt(`${h}.${forged}.${s}`)).toThrow(AppError);
  });
});

describe('تشكيل النص العربي للطباعة', () => {
  it('يكتشف وجود العربية', () => {
    expect(hasArabic('حاوية')).toBe(true);
    expect(hasArabic('VR-000248')).toBe(false);
  });

  it('يوصل الحروف بالأشكال الصحيحة', () => {
    const shaped = shapeArabic('كل');
    // ك أولية (FEDB) + ل نهائية (FEDE)
    expect(Array.from(shaped).map((c) => c.codePointAt(0))).toEqual([0xfedb, 0xfede]);
  });

  it('يطبّق لِغة لام-ألف', () => {
    const shaped = shapeArabic('لا');
    expect(shaped.length).toBe(1);
    expect(shaped.codePointAt(0)).toBe(0xfefb);
  });

  it('يعكس الترتيب ويحفظ الأرقام اللاتينية بترتيبها', () => {
    const out = ar('رقم الحاوية: VR-000248');
    expect(out).toContain('VR-000248');
    expect(out.indexOf('VR-000248')).toBe(0); // العربية على اليمين، اللاتينية على اليسار
  });

  it('يحافظ على مسافة واحدة حول الأرقام داخل النص العربي', () => {
    const out = ar('المسافة 12 متر');
    expect(out).not.toMatch(/ {2}/);
    expect(out).toContain(' 12 ');
  });

  it('يترك النص غير العربي دون تغيير', () => {
    expect(ar('VERO 2026')).toBe('VERO 2026');
    expect(ar(null)).toBe('');
  });

  it('bidiReorder لا يفقد أي محرف', () => {
    const src = shapeArabic('تقرير الخدمة الأسبوعي 2026');
    expect(Array.from(bidiReorder(src)).length).toBe(Array.from(src).length);
  });
});

describe('أكواد التفعيل', () => {
  it('يقبل الكود بصيغه المختلفة', () => {
    expect(normalizeActivationCode('ABCD-2345')).toBe('ABCD-2345');
    expect(normalizeActivationCode('abcd2345')).toBe('ABCD-2345');
    expect(normalizeActivationCode('vero-activate:ABCD-2345')).toBe('ABCD-2345');
    expect(normalizeActivationCode('  abcd 2345  ')).toBe('ABCD-2345');
  });
});

describe('استيراد CSV للحاويات', () => {
  it('يقرأ العناوين الإنجليزية', () => {
    const csv = 'public_id,name,sector,lat,lon\nVR-000001,حاوية أ,ق1,24.7136,46.6753';
    const out = parseBinsCsv(csv);
    expect(out).toHaveLength(1);
    expect(out[0]!.publicId).toBe('VR-000001');
    expect(out[0]!.lat).toBeCloseTo(24.7136);
  });

  it('يقرأ العناوين العربية', () => {
    const csv = 'رقم الحاوية,الاسم,القطاع,خط العرض,خط الطول\nVR-9,حاوية,ق2,24.7,46.6';
    const out = parseBinsCsv(csv);
    expect(out[0]!.publicId).toBe('VR-9');
    expect(out[0]!.sector).toBe('ق2');
  });

  it('يدعم الحقول المقتبسة التي تحوي فواصل', () => {
    const csv = 'public_id,address,lat,lon\nVR-1,"شارع الملك، حي الملز",24.7,46.6';
    const out = parseBinsCsv(csv);
    expect(out[0]!.address).toBe('شارع الملك، حي الملز');
  });

  it('يرفض ملفًا بلا أعمدة إحداثيات', () => {
    expect(() => parseBinsCsv('public_id,name\nVR-1,حاوية')).toThrow(AppError);
  });

  it('يتخطى الأسطر الفارغة', () => {
    const csv = 'public_id,lat,lon\nVR-1,24.7,46.6\n\n\nVR-2,24.8,46.7\n';
    expect(parseBinsCsv(csv)).toHaveLength(2);
  });
});

describe('تغطية الخط المستخدم في PDF', () => {
  /**
   * حارس انحدار: خطوط عربية كثيرة (مثل Noto Naskh Arabic) لا تحوي حروفًا لاتينية،
   * فتظهر أرقام الحاويات ورموز التقارير مربعات فارغة داخل PDF.
   * هذا الاختبار يقرأ جدول cmap من ملف الخط ويتأكد من تغطية كل ما تطبعه التقارير.
   */
  function mappedCodepoints(path: string): Set<number> {
    const buf = readFileSync(path);
    const u16 = (o: number) => buf.readUInt16BE(o);
    const u32 = (o: number) => buf.readUInt32BE(o);

    let cmapOff = 0;
    const numTables = u16(4);
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      if (buf.toString('ascii', o, o + 4) === 'cmap') cmapOff = u32(o + 8);
    }
    if (cmapOff === 0) throw new Error('الخط بلا جدول cmap');

    let best = 0;
    const n = u16(cmapOff + 2);
    for (let i = 0; i < n; i++) {
      const o = cmapOff + 4 + i * 8;
      const pid = u16(o);
      const eid = u16(o + 2);
      if ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) best = cmapOff + u32(o + 4);
    }

    const has = new Set<number>();
    const fmt = u16(best);
    if (fmt === 4) {
      const segX2 = u16(best + 6);
      const seg = segX2 / 2;
      const endO = best + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let s = 0; s < seg; s++) {
        const end = u16(endO + s * 2);
        const start = u16(startO + s * 2);
        const delta = buf.readInt16BE(deltaO + s * 2);
        const ro = u16(rangeO + s * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end; c++) {
          let g: number;
          if (ro === 0) g = (c + delta) & 0xffff;
          else {
            const gi = rangeO + s * 2 + ro + (c - start) * 2;
            if (gi + 1 >= buf.length) continue;
            g = u16(gi);
            if (g) g = (g + delta) & 0xffff;
          }
          if (g) has.add(c);
        }
      }
    } else if (fmt === 12) {
      const ng = u32(best + 12);
      for (let i = 0; i < ng; i++) {
        const o = best + 16 + i * 12;
        for (let c = u32(o); c <= u32(o + 4); c++) has.add(c);
      }
    } else {
      throw new Error(`صيغة cmap غير مدعومة في هذا الفحص: ${fmt}`);
    }
    return has;
  }

  // كل ما قد يظهر فعليًا في تقرير أو ملصق
  const REQUIRED = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...'abcdefghijklmnopqrstuvwxyz',
    ...'0123456789',
    ...' -–—.,:;/()%#+',
    ...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
    ...'أإآءةىئؤ',
    '٫',
    'ﻻ', // لِغة لام-ألف
    'ﺍ',
    'ﻟ',
    '·', // النقطة الوسطى المستخدمة في التذييل
  ];

  for (const [label, path] of [
    ['العادي', FONT_REGULAR],
    ['العريض', FONT_BOLD],
  ] as const) {
    it(`الخط ${label} يغطي العربية واللاتينية والأرقام والرموز`, () => {
      const has = mappedCodepoints(path);
      const missing = REQUIRED.filter((ch) => !has.has(ch.codePointAt(0)!));
      expect(missing, `محارف غير مغطاة في الخط: ${missing.join(' ')}`).toEqual([]);
    });
  }
});
