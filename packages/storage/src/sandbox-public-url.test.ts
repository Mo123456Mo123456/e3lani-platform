import { describe, expect, it } from 'vitest';
import { apiPublicBaseUrl } from './sandbox';

describe('apiPublicBaseUrl', () => {
  it('prefers API_PUBLIC_URL', () => {
    expect(
      apiPublicBaseUrl({
        API_PUBLIC_URL: 'https://e3lani-api-staging.onrender.com/',
      }),
    ).toBe('https://e3lani-api-staging.onrender.com');
  });

  it('falls back to RENDER_EXTERNAL_URL before loopback', () => {
    expect(
      apiPublicBaseUrl({
        RENDER_EXTERNAL_URL: 'https://e3lani-api-staging.onrender.com',
        APP_ENV: 'staging',
      }),
    ).toBe('https://e3lani-api-staging.onrender.com');
  });

  it('rejects loopback when deployed even if API_PUBLIC_URL is localhost', () => {
    expect(() =>
      apiPublicBaseUrl({
        API_PUBLIC_URL: 'http://127.0.0.1:3001',
        RENDER_EXTERNAL_URL: 'https://e3lani-api-staging.onrender.com',
        APP_ENV: 'staging',
      }),
    ).not.toThrow();
    expect(
      apiPublicBaseUrl({
        API_PUBLIC_URL: 'http://127.0.0.1:3001',
        RENDER_EXTERNAL_URL: 'https://e3lani-api-staging.onrender.com',
        APP_ENV: 'staging',
      }),
    ).toBe('https://e3lani-api-staging.onrender.com');
  });

  it('throws on staging when only loopback is configured', () => {
    expect(() =>
      apiPublicBaseUrl({
        API_PUBLIC_URL: 'http://localhost:3001',
        APP_ENV: 'staging',
      }),
    ).toThrow(/API_PUBLIC_URL/);
  });

  it('allows loopback for local development', () => {
    expect(apiPublicBaseUrl({ NODE_ENV: 'development' })).toBe('http://127.0.0.1:3001');
  });
});
