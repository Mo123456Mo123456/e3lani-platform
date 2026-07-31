import { describe, expect, it } from 'vitest';
import {
  failureCode, isDurationAllowed, isPermanentFailure, messageFor, renditionsFor,
  replaceExtension, shouldRetry,
} from '../src/lib/media-rules';

describe('تصنيف أخطاء معالجة الوسائط', () => {
  it('يستخرج رمز الخطأ من الرسالة', () => {
    expect(failureCode('VIDEO_TRANSCODE_FAILED: ffmpeg exited')).toBe('VIDEO_TRANSCODE_FAILED');
    expect(failureCode('')).toBe('PROCESSING_FAILED');
  });

  it('أخطاء التحقق نهائية ولا تُعاد المحاولة عليها', () => {
    expect(isPermanentFailure('VIDEO_TOO_LONG')).toBe(true);
    expect(shouldRetry('VIDEO_TOO_LONG', 1, 3)).toBe(false);
  });

  it('الأخطاء المؤقتة تُعاد حتى الحد الأقصى', () => {
    expect(shouldRetry('VIDEO_TRANSCODE_FAILED', 1, 3)).toBe(true);
    expect(shouldRetry('VIDEO_TRANSCODE_FAILED', 3, 3)).toBe(false);
  });

  it('يعيد رسالة عربية وإنجليزية لكل رمز', () => {
    expect(messageFor('VIDEO_TOO_LONG').ar).toContain('مدة الفيديو');
    expect(messageFor('UNKNOWN_CODE').en).toBe('Processing failed');
  });
});

describe('مفاتيح النسخ المشتقة', () => {
  it('يبدّل الامتداد ويضيف اللاحقة', () => {
    expect(replaceExtension('ad/2026/01/user/abc.jpg', 'thumb', 'webp')).toBe(
      'ad/2026/01/user/abc-thumb.webp',
    );
    expect(replaceExtension('ad/video.mov', '720p', 'mp4')).toBe('ad/video-720p.mp4');
  });
});

describe('نسخ الفيديو', () => {
  it('لا يكبّر الفيديو أبدًا', () => {
    expect(renditionsFor(1080).map((item) => item.name)).toEqual(['720p', '480p']);
    expect(renditionsFor(600).map((item) => item.name)).toEqual(['480p']);
    expect(renditionsFor(360).map((item) => item.name)).toEqual(['480p']);
  });
});

describe('حد مدة الفيديو', () => {
  it('يقبل حتى ٦٠ ثانية ويرفض ما بعدها', () => {
    expect(isDurationAllowed(59.9, 60)).toBe(true);
    expect(isDurationAllowed(60.4, 60)).toBe(true);
    expect(isDurationAllowed(61.2, 60)).toBe(false);
    expect(isDurationAllowed(0, 60)).toBe(false);
  });
});
