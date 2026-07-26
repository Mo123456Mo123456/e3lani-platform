import { describe, expect, it } from 'vitest';
import { assertNoClientControlledUrl, planRenditions } from './index';

describe('media worker', () => {
  it('plans video renditions', () => {
    expect(planRenditions('video')).toEqual(['1080p', '720p', '480p']);
  });

  it('rejects untrusted media hosts', () => {
    expect(() => assertNoClientControlledUrl('https://evil.example/a.mp4', ['cdn.e3lani.sa'])).toThrow(
      /not allowed/,
    );
  });
});
