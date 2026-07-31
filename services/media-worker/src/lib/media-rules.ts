/**
 * قواعد معالجة الوسائط الخالصة (بدون أي اعتماد على الشبكة أو نظام الملفات)،
 * حتى يمكن اختبارها بشكل مباشر.
 */

export const FAILURE_MESSAGES: Record<string, { ar: string; en: string }> = {
  VIDEO_TOO_LONG: { ar: 'مدة الفيديو تتجاوز الحد المسموح', en: 'Video exceeds the allowed duration' },
  VIDEO_PROBE_FAILED: { ar: 'تعذّر قراءة ملف الفيديو', en: 'Unreadable video file' },
  VIDEO_STREAM_MISSING: { ar: 'الملف لا يحتوي على مسار فيديو', en: 'No video stream found' },
  VIDEO_METADATA_UNREADABLE: { ar: 'تعذّر قراءة بيانات الفيديو', en: 'Unreadable video metadata' },
  IMAGE_METADATA_UNREADABLE: { ar: 'تعذّر قراءة ملف الصورة', en: 'Unreadable image file' },
  MEDIA_TOO_LARGE: { ar: 'حجم الملف يتجاوز الحد المسموح', en: 'File exceeds the allowed size' },
};

/** يستخرج رمز الخطأ من رسالة على شكل CODE: تفاصيل */
export function failureCode(message: string): string {
  return (message.split(':')[0] ?? '').trim() || 'PROCESSING_FAILED';
}

/** أخطاء التحقق نهائية: لا فائدة من إعادة المحاولة عليها. */
export function isPermanentFailure(code: string): boolean {
  return Boolean(FAILURE_MESSAGES[code]);
}

export function shouldRetry(code: string, attemptsMade: number, maxAttempts: number): boolean {
  if (isPermanentFailure(code)) return false;
  return attemptsMade < maxAttempts;
}

export function messageFor(code: string): { ar: string; en: string } {
  return FAILURE_MESSAGES[code] ?? { ar: 'تعذّرت معالجة الملف', en: 'Processing failed' };
}

/** يضيف لاحقة ويبدّل الامتداد: ad/x.jpg + (thumb, webp) ← ad/x-thumb.webp */
export function replaceExtension(key: string, suffix: string, extension: string): string {
  const withoutExtension = key.replace(/\.[^./]+$/, '');
  return `${withoutExtension}-${suffix}.${extension}`;
}

export interface Rendition {
  name: string;
  height: number;
  bitrate: string;
}

const ALL_RENDITIONS: Rendition[] = [
  { name: '720p', height: 720, bitrate: '2000k' },
  { name: '480p', height: 480, bitrate: '900k' },
];

/** لا نكبّر الفيديو أبدًا: نختار النسخ المناسبة لارتفاع المصدر فقط. */
export function renditionsFor(sourceHeight: number): Rendition[] {
  const usable = ALL_RENDITIONS.filter((rendition) => sourceHeight >= rendition.height);
  return usable.length ? usable : [ALL_RENDITIONS[ALL_RENDITIONS.length - 1]!];
}

/** يتحقق من مدة الفيديو مقابل الحد المسموح مع هامش تقريب بسيط. */
export function isDurationAllowed(durationSeconds: number, maxSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds <= maxSeconds + 0.5;
}
