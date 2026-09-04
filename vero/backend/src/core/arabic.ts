/**
 * تشكيل النص العربي للطباعة في PDF.
 *
 * PDFKit يرسم المحارف كما هي بلا محرّك تشكيل (shaping) ولا ترتيب ثنائي الاتجاه،
 * فتظهر الحروف العربية منفصلة ومعكوسة. هذه الوحدة تحوّل النص العربي إلى
 * «أشكال العرض العربية» (Arabic Presentation Forms, U+FE70–U+FEFF) وتعكس ترتيبه،
 * فيخرج في PDF متصلًا وصحيح الاتجاه.
 *
 * النطاق المدعوم: العربية القياسية + الأرقام + اللاتينية المدمجة + علامات الترقيم
 * + لِغاتُ لام-ألف. غير مدعوم: التشكيل المعقّد متعدد الطبقات وبعض حروف الفارسية/الأردية.
 */

interface Forms {
  isolated: number;
  final: number;
  initial?: number;
  medial?: number;
}

// جدول أشكال الحروف العربية → Arabic Presentation Forms-B
const FORMS: Record<number, Forms> = {
  0x0621: { isolated: 0xfe80, final: 0xfe80 }, // ء
  0x0622: { isolated: 0xfe81, final: 0xfe82 }, // آ
  0x0623: { isolated: 0xfe83, final: 0xfe84 }, // أ
  0x0624: { isolated: 0xfe85, final: 0xfe86 }, // ؤ
  0x0625: { isolated: 0xfe87, final: 0xfe88 }, // إ
  0x0626: { isolated: 0xfe89, final: 0xfe8a, initial: 0xfe8b, medial: 0xfe8c }, // ئ
  0x0627: { isolated: 0xfe8d, final: 0xfe8e }, // ا
  0x0628: { isolated: 0xfe8f, final: 0xfe90, initial: 0xfe91, medial: 0xfe92 }, // ب
  0x0629: { isolated: 0xfe93, final: 0xfe94 }, // ة
  0x062a: { isolated: 0xfe95, final: 0xfe96, initial: 0xfe97, medial: 0xfe98 }, // ت
  0x062b: { isolated: 0xfe99, final: 0xfe9a, initial: 0xfe9b, medial: 0xfe9c }, // ث
  0x062c: { isolated: 0xfe9d, final: 0xfe9e, initial: 0xfe9f, medial: 0xfea0 }, // ج
  0x062d: { isolated: 0xfea1, final: 0xfea2, initial: 0xfea3, medial: 0xfea4 }, // ح
  0x062e: { isolated: 0xfea5, final: 0xfea6, initial: 0xfea7, medial: 0xfea8 }, // خ
  0x062f: { isolated: 0xfea9, final: 0xfeaa }, // د
  0x0630: { isolated: 0xfeab, final: 0xfeac }, // ذ
  0x0631: { isolated: 0xfead, final: 0xfeae }, // ر
  0x0632: { isolated: 0xfeaf, final: 0xfeb0 }, // ز
  0x0633: { isolated: 0xfeb1, final: 0xfeb2, initial: 0xfeb3, medial: 0xfeb4 }, // س
  0x0634: { isolated: 0xfeb5, final: 0xfeb6, initial: 0xfeb7, medial: 0xfeb8 }, // ش
  0x0635: { isolated: 0xfeb9, final: 0xfeba, initial: 0xfebb, medial: 0xfebc }, // ص
  0x0636: { isolated: 0xfebd, final: 0xfebe, initial: 0xfebf, medial: 0xfec0 }, // ض
  0x0637: { isolated: 0xfec1, final: 0xfec2, initial: 0xfec3, medial: 0xfec4 }, // ط
  0x0638: { isolated: 0xfec5, final: 0xfec6, initial: 0xfec7, medial: 0xfec8 }, // ظ
  0x0639: { isolated: 0xfec9, final: 0xfeca, initial: 0xfecb, medial: 0xfecc }, // ع
  0x063a: { isolated: 0xfecd, final: 0xfece, initial: 0xfecf, medial: 0xfed0 }, // غ
  0x0640: { isolated: 0x0640, final: 0x0640, initial: 0x0640, medial: 0x0640 }, // ـ تطويل
  0x0641: { isolated: 0xfed1, final: 0xfed2, initial: 0xfed3, medial: 0xfed4 }, // ف
  0x0642: { isolated: 0xfed5, final: 0xfed6, initial: 0xfed7, medial: 0xfed8 }, // ق
  0x0643: { isolated: 0xfed9, final: 0xfeda, initial: 0xfedb, medial: 0xfedc }, // ك
  0x0644: { isolated: 0xfedd, final: 0xfede, initial: 0xfedf, medial: 0xfee0 }, // ل
  0x0645: { isolated: 0xfee1, final: 0xfee2, initial: 0xfee3, medial: 0xfee4 }, // م
  0x0646: { isolated: 0xfee5, final: 0xfee6, initial: 0xfee7, medial: 0xfee8 }, // ن
  0x0647: { isolated: 0xfee9, final: 0xfeea, initial: 0xfeeb, medial: 0xfeec }, // ه
  0x0648: { isolated: 0xfeed, final: 0xfeee }, // و
  0x0649: { isolated: 0xfeef, final: 0xfef0 }, // ى
  0x064a: { isolated: 0xfef1, final: 0xfef2, initial: 0xfef3, medial: 0xfef4 }, // ي
  0x0671: { isolated: 0xfb50, final: 0xfb51 }, // ٱ
  0x067e: { isolated: 0xfb56, final: 0xfb57, initial: 0xfb58, medial: 0xfb59 }, // پ
  0x0686: { isolated: 0xfb7a, final: 0xfb7b, initial: 0xfb7c, medial: 0xfb7d }, // چ
  0x0698: { isolated: 0xfb8a, final: 0xfb8b }, // ژ
  0x06a9: { isolated: 0xfb8e, final: 0xfb8f, initial: 0xfb90, medial: 0xfb91 }, // ک
  0x06af: { isolated: 0xfb92, final: 0xfb93, initial: 0xfb94, medial: 0xfb95 }, // گ
  0x06cc: { isolated: 0xfbfc, final: 0xfbfd, initial: 0xfbfe, medial: 0xfbff }, // ی
};

// لِغات لام-ألف: [ألف] → [منفصل, نهائي]
const LAM_ALEF: Record<number, [number, number]> = {
  0x0622: [0xfef5, 0xfef6],
  0x0623: [0xfef7, 0xfef8],
  0x0625: [0xfef9, 0xfefa],
  0x0627: [0xfefb, 0xfefc],
};

const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭ]/;

const isArabicLetter = (cp: number): boolean => FORMS[cp] !== undefined;
const canJoinNext = (cp: number): boolean => FORMS[cp]?.initial !== undefined;
const canJoinPrev = (cp: number): boolean => isArabicLetter(cp);

/** هل يحتوي النص على حروف عربية؟ */
export function hasArabic(text: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text);
}

const isRtlChar = (cp: number): boolean =>
  (cp >= 0x0600 && cp <= 0x06ff) ||
  (cp >= 0x0750 && cp <= 0x077f) ||
  (cp >= 0xfb50 && cp <= 0xfdff) ||
  (cp >= 0xfe70 && cp <= 0xfeff);

const isNeutral = (ch: string): boolean => /[\s.,;:!؟?"'()[\]{}«»\-–—/\\|]/.test(ch);

const MIRROR: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '«': '»',
  '»': '«',
  '<': '>',
  '>': '<',
};

/**
 * يحوّل النص العربي إلى أشكال العرض المتصلة (بدون عكس الاتجاه).
 */
export function shapeArabic(text: string): string {
  const chars = Array.from(text);
  const out: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const cp = ch.codePointAt(0)!;

    if (HARAKAT.test(ch)) {
      out.push(ch); // التشكيل يُمرَّر كما هو
      continue;
    }
    if (!isArabicLetter(cp)) {
      out.push(ch);
      continue;
    }

    // البحث عن الحرف الفعّال السابق/التالي مع تخطي التشكيل
    let prevCp = 0;
    for (let j = i - 1; j >= 0; j--) {
      const c = chars[j]!;
      if (HARAKAT.test(c)) continue;
      prevCp = c.codePointAt(0)!;
      break;
    }
    let nextIdx = -1;
    let nextCp = 0;
    for (let j = i + 1; j < chars.length; j++) {
      const c = chars[j]!;
      if (HARAKAT.test(c)) continue;
      nextIdx = j;
      nextCp = c.codePointAt(0)!;
      break;
    }

    // لِغة لام-ألف
    if (cp === 0x0644 && LAM_ALEF[nextCp]) {
      const joinedPrev = prevCp !== 0 && canJoinNext(prevCp);
      const pair = LAM_ALEF[nextCp]!;
      out.push(String.fromCodePoint(joinedPrev ? pair[1] : pair[0]));
      // نتخطى الألف وأي تشكيل بينهما
      i = nextIdx;
      continue;
    }

    const forms = FORMS[cp]!;
    const joinPrev = prevCp !== 0 && canJoinNext(prevCp);
    const joinNext = nextCp !== 0 && canJoinPrev(nextCp) && forms.initial !== undefined;

    let form: number;
    if (joinPrev && joinNext) form = forms.medial ?? forms.final;
    else if (joinPrev) form = forms.final;
    else if (joinNext) form = forms.initial ?? forms.isolated;
    else form = forms.isolated;

    out.push(String.fromCodePoint(form));
  }

  return out.join('');
}

/**
 * ترتيب ثنائي الاتجاه مبسّط: يعكس المقاطع العربية ويُبقي المقاطع اللاتينية والأرقام
 * بترتيبها الطبيعي، مع عكس الأقواس المتماثلة.
 *
 * يغطي الاستخدام العملي (عناوين، أسماء، أرقام، تواريخ) دون تعقيد خوارزمية UBA الكاملة.
 */
export function bidiReorder(shaped: string): string {
  const chars = Array.from(shaped);
  if (chars.length === 0) return '';

  // 1) تصنيف كل محرف: R (عربي) / L (لاتيني وأرقام) / N (محايد)
  type Dir = 'R' | 'L' | 'N';
  const dirs: Dir[] = chars.map((ch) => {
    const cp = ch.codePointAt(0)!;
    if (isRtlChar(cp) || HARAKAT.test(ch)) return 'R';
    if (isNeutral(ch)) return 'N';
    return 'L';
  });

  // 2) حلّ المحايدات (قاعدة N1/N2 من خوارزمية Unicode ثنائية الاتجاه):
  //    المحايد بين اتجاهين متماثلين يأخذ اتجاههما، وإلا يأخذ اتجاه الفقرة (RTL هنا).
  const PARAGRAPH: Dir = 'R';
  for (let i = 0; i < dirs.length; ) {
    if (dirs[i] !== 'N') {
      i++;
      continue;
    }
    let j = i;
    while (j < dirs.length && dirs[j] === 'N') j++;
    let prev: Dir = PARAGRAPH;
    for (let k = i - 1; k >= 0; k--) {
      if (dirs[k] !== 'N') {
        prev = dirs[k]!;
        break;
      }
    }
    let next: Dir = PARAGRAPH;
    for (let k = j; k < dirs.length; k++) {
      if (dirs[k] !== 'N') {
        next = dirs[k]!;
        break;
      }
    }
    const resolved: Dir = prev === next ? prev : PARAGRAPH;
    for (let k = i; k < j; k++) dirs[k] = resolved;
    i = j;
  }

  // 3) تجميع المقاطع المتجانسة
  type Seg = { rtl: boolean; chars: string[] };
  const segs: Seg[] = [];
  for (let i = 0; i < chars.length; i++) {
    const rtl = dirs[i] === 'R';
    const last = segs[segs.length - 1];
    if (last && last.rtl === rtl) last.chars.push(chars[i]!);
    else segs.push({ rtl, chars: [chars[i]!] });
  }

  // نبني من اليمين لليسار: المقاطع تُعكس، ومحتوى المقطع العربي يُعكس أيضًا
  const out: string[] = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i]!;
    if (seg.rtl) {
      for (let j = seg.chars.length - 1; j >= 0; j--) {
        const c = seg.chars[j]!;
        out.push(MIRROR[c] ?? c);
      }
    } else {
      out.push(...seg.chars);
    }
  }
  return out.join('');
}

/**
 * يجهّز نصًا عربيًا للطباعة في PDF: تشكيل ثم إعادة ترتيب.
 * النص الخالي من العربية يعود كما هو.
 */
export function ar(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const s = String(text);
  if (!hasArabic(s)) return s;
  return bidiReorder(shapeArabic(s));
}
