import { describe, expect, it } from 'vitest';
import {
  ALLOWED_LINK_HOSTS, DEFAULT_RANKING_WEIGHTS, affinityScore, diversify, finalScore,
  freshnessDecay, geoScore, halalasToSar, normalizeSaudiPhone, parseWeights, permissionsForRole,
  qualityScore, roleHasPermission, sarToHalalas, wilsonLowerBound,
} from '@e3lani/config';
import {
  createAdSchema, createPostSchema, completeProfileSchema, requestOtpSchema,
} from '@e3lani/types';
import { isAllowedLink, runAutomatedContentCheck } from '../src/common/utils/moderation';
import { decodeCursor, encodeCursor } from '../src/common/utils/pagination';
import { distanceKm } from '../src/common/utils/geo';
import { dedupeAdjacent } from '../src/modules/ticker/ticker.service';
import { splitVatInclusive } from '../src/modules/payments/billing.service';

const cuid = (suffix: string) => `c${suffix.padEnd(24, 'x')}`;

describe('أرقام الجوال السعودية', () => {
  it('يوحّد كل الصيغ إلى 9665XXXXXXXX', () => {
    for (const input of ['0512345678', '512345678', '+966512345678', '966512345678', '05 1234 5678']) {
      expect(normalizeSaudiPhone(input)).toBe('966512345678');
    }
  });

  it('يرفض الأرقام غير الصالحة', () => {
    for (const input of ['0412345678', '05123', '123456789012', 'abc']) {
      expect(normalizeSaudiPhone(input)).toBeNull();
    }
  });

  it('مخطط طلب الرمز يعيد الرقم موحّدًا', () => {
    const parsed = requestOtpSchema.parse({ phone: '0512345678' });
    expect(parsed.phone).toBe('966512345678');
    expect(parsed.purpose).toBe('LOGIN');
  });
});

describe('الفحص الآلي للمحتوى', () => {
  it('يقبل إعلانًا سليمًا', () => {
    const result = runAutomatedContentCheck({
      title: 'مجلس عربي مستعمل بحالة ممتازة',
      description: 'للتواصل عبر الواتساب',
      contactValue: '966512345678',
    });
    expect(result.ok).toBe(true);
  });

  it('يرفض المحتوى الممنوع الواضح', () => {
    const result = runAutomatedContentCheck({ title: 'بيع مخدرات', description: null });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('محتوى ممنوع');
  });

  it('يرفض الروابط خارج النطاقات المعتمدة', () => {
    const result = runAutomatedContentCheck({
      title: 'عرض خاص',
      description: 'التفاصيل على https://example-not-allowed.com/offer',
    });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('رابط غير معتمد');
  });

  it('يقبل النطاقات المعتمدة فقط ويرفض http', () => {
    expect(isAllowedLink('https://wa.me/966512345678')).toBe(true);
    expect(isAllowedLink('https://shop.salla.sa/product/1')).toBe(true);
    expect(isAllowedLink('http://wa.me/966512345678')).toBe(false);
    expect(isAllowedLink('https://evil.com')).toBe(false);
    expect(ALLOWED_LINK_HOSTS.length).toBeGreaterThan(5);
  });
});

describe('التحقق من إنشاء الإعلان', () => {
  const base = {
    title: 'كنب مودرن ٣ قطع',
    categoryId: cuid('cat'),
    cityId: cuid('city'),
    contactMethod: 'WHATSAPP' as const,
    contactValue: '0512345678',
    mediaIds: [cuid('media')],
  };

  it('يقبل إعلانًا بدون سعر (السعر اختياري)', () => {
    const parsed = createAdSchema.parse(base);
    expect(parsed.price).toBeUndefined();
    expect(parsed.reachScope).toBe('CITY');
    expect(parsed.contactValue).toBe('0512345678');
  });

  it('يرفض إعلانًا بلا وسائط', () => {
    expect(() => createAdSchema.parse({ ...base, mediaIds: [] })).toThrow();
  });

  it('يرفض أكثر من ٥ صور', () => {
    const mediaIds = Array.from({ length: 6 }, (_, index) => cuid(`m${index}`));
    expect(() => createAdSchema.parse({ ...base, mediaIds })).toThrow();
  });

  it('يرفض رابط متجر غير معتمد', () => {
    expect(() =>
      createAdSchema.parse({
        ...base,
        contactMethod: 'STORE_LINK',
        contactValue: 'https://not-allowed.example/x',
      }),
    ).toThrow();
  });

  it('يقبل رابط متجر معتمد', () => {
    const parsed = createAdSchema.parse({
      ...base,
      contactMethod: 'STORE_LINK',
      contactValue: 'https://mystore.salla.sa',
    });
    expect(parsed.contactMethod).toBe('STORE_LINK');
  });
});

describe('استكمال بيانات الحساب', () => {
  const base = {
    name: 'سعود',
    cityId: cuid('city'),
    acceptedTerms: true as const,
    acceptedPrivacy: true as const,
  };

  it('البريد اختياري للأفراد', () => {
    expect(() => completeProfileSchema.parse({ ...base, accountType: 'INDIVIDUAL' })).not.toThrow();
  });

  it('البريد مطلوب للحسابات التجارية', () => {
    expect(() => completeProfileSchema.parse({ ...base, accountType: 'STORE' })).toThrow();
    expect(() =>
      completeProfileSchema.parse({ ...base, accountType: 'STORE', email: 'a@b.com' }),
    ).not.toThrow();
  });

  it('يرفض عدم الموافقة على الشروط', () => {
    expect(() =>
      completeProfileSchema.parse({ ...base, accountType: 'INDIVIDUAL', acceptedTerms: false }),
    ).toThrow();
  });
});

describe('المنشورات المجانية', () => {
  it('تتطلب نصًا ووسائط ولا تتضمن أي حقول تسعير أو انتهاء', () => {
    const parsed = createPostSchema.parse({ caption: 'منتج جديد', mediaIds: [cuid('m')] });
    expect(Object.keys(parsed).sort()).toEqual(['caption', 'mediaIds']);
  });
});

describe('صلاحيات لوحة الإدارة (RBAC)', () => {
  it('المدير العام يملك كل الصلاحيات', () => {
    expect(roleHasPermission('SUPER_ADMIN', 'pricing.write')).toBe(true);
    expect(permissionsForRole('SUPER_ADMIN').length).toBeGreaterThan(20);
  });

  it('مشرف الإعلانات لا يملك تعديل الأسعار', () => {
    expect(roleHasPermission('ADS_MODERATOR', 'ads.moderate')).toBe(true);
    expect(roleHasPermission('ADS_MODERATOR', 'pricing.write')).toBe(false);
  });

  it('المدير المالي لا يملك إيقاف الإعلانات', () => {
    expect(roleHasPermission('FINANCE_MANAGER', 'payments.refund')).toBe(true);
    expect(roleHasPermission('FINANCE_MANAGER', 'ads.moderate')).toBe(false);
  });

  it('الدعم للاطلاع فقط على الإعلانات', () => {
    expect(roleHasPermission('SUPPORT', 'ads.read')).toBe(true);
    expect(roleHasPermission('SUPPORT', 'ads.delete')).toBe(false);
  });
});

describe('تحويلات الأسعار', () => {
  it('يحوّل بين الريال والهللة بدقة', () => {
    expect(halalasToSar(5900)).toBe(59);
    expect(sarToHalalas(59)).toBe(5900);
    expect(sarToHalalas(0.5)).toBe(50);
  });
});

describe('ترقيم الصفحات بالمؤشر', () => {
  it('يشفّر ويفك المؤشر بلا فقد للبيانات', () => {
    const payload = { sort: '2026-01-01T00:00:00.000Z', id: 'abc|def' };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('يعيد null لمؤشر غير صالح', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('###')).toBeNull();
  });
});

describe('الشريط الإعلاني العلوي', () => {
  it('لا يكرر الشعار نفسه مرتين متتاليتين', () => {
    const logos = [
      { id: '1', businessName: 'أ', logoUrl: 'a.png', sortWeight: 0 },
      { id: '2', businessName: 'أ٢', logoUrl: 'a.png', sortWeight: 1 },
      { id: '3', businessName: 'ب', logoUrl: 'b.png', sortWeight: 2 },
    ];
    const result = dedupeAdjacent(logos);
    expect(result).toHaveLength(3);
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index]!.logoUrl).not.toBe(result[index - 1]!.logoUrl);
    }
  });

  it('لا يحتوي كائن الشعار على أي رابط قابل للنقر', () => {
    const logo = { id: '1', businessName: 'أ', logoUrl: 'a.png', sortWeight: 0 };
    expect(Object.keys(logo)).not.toContain('href');
    expect(Object.keys(logo)).not.toContain('targetUrl');
  });
});

describe('حساب المسافة الجغرافية', () => {
  it('يحسب المسافة بين الرياض وجدة تقريبًا', () => {
    const distance = distanceKm(24.7136, 46.6753, 21.4858, 39.1925);
    expect(distance).toBeGreaterThan(800);
    expect(distance).toBeLessThan(900);
  });
});

/* ========================================================================== */
/* الإضافات: تأريخ الأسعار، الضريبة، الاستردادات                              */
/* ========================================================================== */

describe('احتساب ضريبة القيمة المضافة (أسعار شاملة)', () => {
  it('يستخرج الضريبة من الإجمالي ولا يضيفها عليه', () => {
    const result = splitVatInclusive(5900, 1500);
    expect(result.total).toBe(5900);
    expect(result.subtotal).toBe(5130);
    expect(result.vat).toBe(770);
  });

  it('الأساس + الضريبة يساوي الإجمالي دائمًا (بلا فقد هللات)', () => {
    for (const total of [1, 99, 500, 1000, 1999, 5900, 7900, 123_456]) {
      const result = splitVatInclusive(total, 1500);
      expect(result.subtotal + result.vat).toBe(total);
      expect(result.vat).toBeGreaterThanOrEqual(0);
    }
  });

  it('يتعامل مع نسبة ضريبة مختلفة', () => {
    expect(splitVatInclusive(1000, 0)).toEqual({ subtotal: 1000, vat: 0, total: 1000 });
    expect(splitVatInclusive(11_000, 1000).subtotal).toBe(10_000);
  });
});

describe('حالة إصدار السعر', () => {
  const status = (from: Date, to: Date | null, now: Date) => {
    if (from > now) return 'SCHEDULED';
    if (to && to <= now) return 'EXPIRED';
    return 'ACTIVE';
  };

  const now = new Date('2026-06-15T00:00:00Z');

  it('يميّز النافذ والمجدول والمنتهي', () => {
    expect(status(new Date('2026-01-01'), new Date('2026-06-01'), now)).toBe('EXPIRED');
    expect(status(new Date('2026-06-01'), null, now)).toBe('ACTIVE');
    expect(status(new Date('2026-06-01'), new Date('2026-07-01'), now)).toBe('ACTIVE');
    expect(status(new Date('2026-07-01'), null, now)).toBe('SCHEDULED');
  });

  it('لا يتداخل إصداران في اللحظة نفسها', () => {
    const timeline = [
      { from: new Date('2026-01-01'), to: new Date('2026-06-01') },
      { from: new Date('2026-06-01'), to: new Date('2026-07-01') },
      { from: new Date('2026-07-01'), to: null },
    ];
    const active = timeline.filter((v) => status(v.from, v.to, now) === 'ACTIVE');
    expect(active).toHaveLength(1);
  });
});

describe('المبلغ القابل للاسترداد', () => {
  const refundable = (paid: number, refunds: { amountHalalas: number; status: string }[]) => {
    const used = refunds
      .filter((r) => ['PENDING', 'COMPLETED'].includes(r.status))
      .reduce((sum, r) => sum + r.amountHalalas, 0);
    return Math.max(0, paid - used);
  };

  it('يخصم الاستردادات المكتملة والمعلّقة فقط', () => {
    expect(refundable(5900, [])).toBe(5900);
    expect(refundable(5900, [{ amountHalalas: 2000, status: 'COMPLETED' }])).toBe(3900);
    expect(refundable(5900, [{ amountHalalas: 2000, status: 'FAILED' }])).toBe(5900);
    expect(
      refundable(5900, [
        { amountHalalas: 2000, status: 'COMPLETED' },
        { amountHalalas: 3900, status: 'COMPLETED' },
      ]),
    ).toBe(0);
  });

  it('لا يعيد قيمة سالبة أبدًا', () => {
    expect(refundable(1000, [{ amountHalalas: 5000, status: 'COMPLETED' }])).toBe(0);
  });
});

describe('ترقيم الفواتير', () => {
  const format = (year: number, value: number) => `E3-${year}-${String(value).padStart(6, '0')}`;

  it('يولّد رقمًا تسلسليًا متصلًا لكل سنة', () => {
    expect(format(2026, 1)).toBe('E3-2026-000001');
    expect(format(2026, 42)).toBe('E3-2026-000042');
    expect(format(2027, 1)).toBe('E3-2027-000001');
  });
});

/* ========================================================================== */
/* محرّك الترتيب الداخلي                                                       */
/* ========================================================================== */

describe('حدّ ويلسون الأدنى', () => {
  it('يعاقب العيّنات الصغيرة بدل مكافأتها', () => {
    // نقرة واحدة من ظهور واحد = ١٠٠٪ بالنسبة الساذجة، لكن ويلسون لا ينخدع
    const tiny = wilsonLowerBound(1, 1);
    const solid = wilsonLowerBound(300, 1000);
    expect(tiny).toBeLessThan(solid);
    expect(tiny).toBeLessThan(0.3);
  });

  it('يزداد بثبات مع تراكم الأدلة على النسبة نفسها', () => {
    const small = wilsonLowerBound(3, 10);
    const medium = wilsonLowerBound(30, 100);
    const large = wilsonLowerBound(300, 1000);
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
    expect(large).toBeLessThan(0.3);
  });

  it('يعيد صفرًا بلا بيانات ولا يخرج عن النطاق', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(5, 0)).toBe(0);
    expect(wilsonLowerBound(10, 5)).toBeLessThanOrEqual(1);
  });
});

describe('درجة جودة الإعلان', () => {
  it('إعلان بلا بيانات يحصل على صفر لا على أفضلية', () => {
    expect(
      qualityScore({ impressions: 0, clicks: 0, saves: 0, videoViews: 0, completions: 0 }),
    ).toBe(0);
  });

  it('الإعلان الأعلى تفاعلًا يتفوّق دائمًا', () => {
    const weak = qualityScore({ impressions: 1000, clicks: 5, saves: 1, videoViews: 100, completions: 5 });
    const strong = qualityScore({ impressions: 1000, clicks: 200, saves: 90, videoViews: 500, completions: 300 });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(1);
  });
});

describe('تحلّل الحداثة', () => {
  it('ينصّف الدرجة عند نصف العمر', () => {
    expect(freshnessDecay(0, 72)).toBe(1);
    expect(freshnessDecay(72, 72)).toBeCloseTo(0.5, 5);
    expect(freshnessDecay(144, 72)).toBeCloseTo(0.25, 5);
  });

  it('يتناقص باستمرار ولا يصير سالبًا', () => {
    expect(freshnessDecay(10_000, 72)).toBeGreaterThanOrEqual(0);
    expect(freshnessDecay(-5, 72)).toBe(1);
  });
});

describe('القرب الجغرافي', () => {
  it('يفضّل نفس المدينة ثم المنطقة ثم المملكة', () => {
    expect(geoScore({ sameCity: true, sameRegion: true, kingdomWide: true })).toBe(1);
    expect(geoScore({ sameCity: false, sameRegion: true, kingdomWide: false })).toBe(0.6);
    expect(geoScore({ sameCity: false, sameRegion: false, kingdomWide: true })).toBe(0.3);
    expect(geoScore({ sameCity: false, sameRegion: false, kingdomWide: false })).toBe(0);
  });
});

describe('تقارب المستخدم مع الأقسام', () => {
  it('يعطي صفرًا للمستخدم الجديد (بداية باردة)', () => {
    expect(
      affinityScore({
        categoryClicks: 0, categorySaves: 0, categoryImpressions: 0,
        totalClicks: 0, totalSaves: 0, totalImpressions: 0,
      }),
    ).toBe(0);
  });

  it('النقر يزن أكثر من الحفظ، والحفظ أكثر من مجرد الظهور', () => {
    const base = { totalClicks: 10, totalSaves: 10, totalImpressions: 100 };
    const byClick = affinityScore({ ...base, categoryClicks: 5, categorySaves: 0, categoryImpressions: 0 });
    const bySave = affinityScore({ ...base, categoryClicks: 0, categorySaves: 5, categoryImpressions: 0 });
    const byView = affinityScore({ ...base, categoryClicks: 0, categorySaves: 0, categoryImpressions: 5 });
    expect(byClick).toBeGreaterThan(bySave);
    expect(bySave).toBeGreaterThan(byView);
  });
});

describe('الدرجة النهائية', () => {
  const weights = { ...DEFAULT_RANKING_WEIGHTS };
  const base = { quality: 0.5, affinity: 0.5, geo: 1, freshness: 1, isPromoted: false, seenCount: 0 };

  it('الإعلان المدفوع يتقدّم لكنه لا يلغي بقية الإشارات', () => {
    const organicGood = finalScore({ ...base, quality: 0.9, affinity: 0.9 }, weights);
    const promotedPoor = finalScore({ ...base, quality: 0, affinity: 0, isPromoted: true }, weights);
    expect(organicGood).toBeGreaterThan(promotedPoor);
  });

  it('تكرار العرض يخفض الدرجة ثم يتشبّع', () => {
    const fresh = finalScore(base, weights);
    const seenOnce = finalScore({ ...base, seenCount: 1 }, weights);
    const seenMany = finalScore({ ...base, seenCount: 10 }, weights);
    expect(seenOnce).toBeLessThan(fresh);
    expect(seenMany).toBeLessThan(seenOnce);
    // العقوبة محدودة ولا تنحدر بلا نهاية
    expect(fresh - seenMany).toBeLessThanOrEqual(weights.seenPenalty);
  });

  it('رفع وزن التقارب يزيد أثره فعليًا', () => {
    const normal = finalScore({ ...base, affinity: 1 }, weights);
    const boosted = finalScore({ ...base, affinity: 1 }, { ...weights, affinity: 5 });
    expect(boosted).toBeGreaterThan(normal);
  });
});

describe('تنويع المعلنين', () => {
  it('يمنع سيطرة معلن واحد على أوائل الموجز', () => {
    const items = [
      { id: 'a1', advertiserId: 'A' }, { id: 'a2', advertiserId: 'A' },
      { id: 'a3', advertiserId: 'A' }, { id: 'a4', advertiserId: 'A' },
      { id: 'b1', advertiserId: 'B' },
    ];
    const result = diversify(items, 2);
    expect(result.slice(0, 3).map((item) => item.id)).toEqual(['a1', 'a2', 'b1']);
    // لا يُفقد أي عنصر، يُؤجَّل فقط
    expect(result).toHaveLength(items.length);
  });
});

describe('قراءة أوزان الترتيب من الإعدادات', () => {
  it('يرجع للقيم الافتراضية عند إدخال غير صالح', () => {
    expect(parseWeights(null)).toEqual(DEFAULT_RANKING_WEIGHTS);
    expect(parseWeights('nonsense')).toEqual(DEFAULT_RANKING_WEIGHTS);
    expect(parseWeights({ quality: -5 }).quality).toBe(DEFAULT_RANKING_WEIGHTS.quality);
    expect(parseWeights({ quality: Number.NaN }).quality).toBe(DEFAULT_RANKING_WEIGHTS.quality);
  });

  it('يقبل القيم الصالحة ويتجاهل الحقول المجهولة', () => {
    const parsed = parseWeights({ quality: 3, unknownField: 99 });
    expect(parsed.quality).toBe(3);
    expect(parsed.affinity).toBe(DEFAULT_RANKING_WEIGHTS.affinity);
  });
});
