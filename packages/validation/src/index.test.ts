import { describe, expect, it } from 'vitest';
import { createAdDraftSchema, requestOtpSchema, validateMediaIntent } from './index';

describe('validation', () => {
  it('accepts E.164 Saudi phone with terms', () => {
    const parsed = requestOtpSchema.parse({
      phone: '+966500000001',
      acceptedTerms: true,
    });
    expect(parsed.countryCode).toBe('SA');
  });

  it('requires a contact method on ad draft', () => {
    expect(() =>
      createAdDraftSchema.parse({
        title: 'إعلان تجريبي',
        categoryId: '00000000-0000-4000-8000-000000000001',
        countryCode: 'SA',
        cityId: '00000000-0000-4000-8000-000000000002',
        contactMethods: {},
      }),
    ).toThrow();
  });

  it('rejects oversized video', () => {
    expect(() =>
      validateMediaIntent({
        kind: 'video',
        mimeType: 'video/mp4',
        sizeBytes: 250 * 1024 * 1024,
        durationSeconds: 30,
      }),
    ).toThrow(/200MB/);
  });

  it('rejects unsupported mime types', () => {
    expect(() =>
      validateMediaIntent({
        kind: 'image',
        mimeType: 'image/gif',
        sizeBytes: 1024,
      }),
    ).toThrow(/Unsupported image mime/);
    expect(() =>
      validateMediaIntent({
        kind: 'video',
        mimeType: 'video/avi',
        sizeBytes: 1024,
        durationSeconds: 10,
      }),
    ).toThrow(/Unsupported video mime/);
  });

  it('requires video duration and enforces 60s', () => {
    expect(() =>
      validateMediaIntent({
        kind: 'video',
        mimeType: 'video/mp4',
        sizeBytes: 1024,
      }),
    ).toThrow(/durationSeconds/);
    expect(() =>
      validateMediaIntent({
        kind: 'video',
        mimeType: 'video/mp4',
        sizeBytes: 1024,
        durationSeconds: 90,
      }),
    ).toThrow(/60 seconds/);
  });

  it('rejects oversized images and normalizes image/jpg', () => {
    expect(() =>
      validateMediaIntent({
        kind: 'image',
        mimeType: 'image/png',
        sizeBytes: 25 * 1024 * 1024,
      }),
    ).toThrow(/20MB/);
    const ok = validateMediaIntent({
      kind: 'image',
      mimeType: 'image/jpg',
      sizeBytes: 2048,
      fileName: '../../evil.exe',
    });
    expect(ok.mimeType).toBe('image/jpeg');
  });

  it('accepts allowed MP4/MOV/JPEG/PNG/WebP', () => {
    expect(
      validateMediaIntent({
        kind: 'image',
        mimeType: 'image/webp',
        sizeBytes: 1000,
      }).mimeType,
    ).toBe('image/webp');
    expect(
      validateMediaIntent({
        kind: 'video',
        mimeType: 'video/quicktime',
        sizeBytes: 1000,
        durationSeconds: 15,
      }).mimeType,
    ).toBe('video/quicktime');
  });
});
