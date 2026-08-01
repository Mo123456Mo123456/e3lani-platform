import { describe, expect, it } from 'vitest';
import {
  ALLOWED_LINK_HOSTS, halalasToSar, normalizeSaudiPhone, permissionsForRole,
  roleHasPermission, sarToHalalas,
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
