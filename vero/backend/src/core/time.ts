/**
 * «يوم الخدمة» (service_day) هو التاريخ بتوقيت الشركة وقت وقوع المسح.
 * هذا ما يجعل عدّاد اليوم يصفّر تلقائيًا عند منتصف الليل المحلي بغض النظر عن
 * توقيت السيرفر أو الجهاز، ودون أي وظيفة مجدولة.
 */

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let f = cache.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    cache.set(timezone, f);
  }
  return f;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** يُرجع `YYYY-MM-DD` بتوقيت الشركة. */
export function serviceDay(at: Date, timezone: string): string {
  // en-CA يعطي بالضبط YYYY-MM-DD
  return formatter(timezone).format(at);
}

export function todayServiceDay(timezone: string): string {
  return serviceDay(new Date(), timezone);
}

/** يزيح تاريخًا بصيغة YYYY-MM-DD بعدد أيام (بدون منطقة زمنية — حساب تقويمي بحت). */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** عدد الأيام الشامل بين تاريخين (inclusive). */
export function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** قائمة الأيام بين تاريخين شاملة الطرفين. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const n = daysBetweenInclusive(from, to);
  for (let i = 0; i < n; i++) out.push(addDays(from, i));
  return out;
}

export const isIsoDay = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);
