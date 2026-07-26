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
});
