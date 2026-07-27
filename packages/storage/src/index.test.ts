import { describe, expect, it } from 'vitest';
import { assertAllowedStorageKey, buildObjectKey } from './index';

describe('storage keys', () => {
  it('builds upload keys under uploads/', () => {
    const key = buildObjectKey({
      ownerId: 'user-1',
      kind: 'image',
      mimeType: 'image/jpeg',
    });
    expect(key.startsWith('uploads/')).toBe(true);
    expect(key.includes('/image/')).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
  });

  it('rejects client-controlled traversal keys', () => {
    expect(() => assertAllowedStorageKey('../etc/passwd')).toThrow(/NOT_ALLOWED|INVALID/);
    expect(() => assertAllowedStorageKey('uploads/../secret')).toThrow(/INVALID/);
  });
});
