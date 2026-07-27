import { describe, expect, it } from 'vitest';
import { assertNoClientControlledUrl, planRenditions } from './processor';

describe('media worker', () => {
  it('plans video renditions', () => {
    expect(planRenditions('video')).toEqual(['poster', '720p']);
  });

  it('rejects untrusted media hosts', () => {
    expect(() => assertNoClientControlledUrl('https://evil.example/a.mp4', ['cdn.e3lani.sa'])).toThrow(
      /not allowed/,
    );
  });
});
