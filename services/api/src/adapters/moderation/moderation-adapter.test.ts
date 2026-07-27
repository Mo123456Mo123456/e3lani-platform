import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpModerationAdapter,
  ModerationProviderNotConfiguredError,
  createModerationAdapter,
} from './moderation-adapter';

const revision = {
  id: 'rev-1',
  title: 'Clean ad',
  description: 'A normal listing',
  categoryId: 'cat-1',
  countryCode: 'SA',
  cityId: 'city-1',
};

describe('HttpModerationAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('maps provider APPROVE responses to AUTO_APPROVED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          decision: 'APPROVE',
          riskScore: 0.03,
          findings: [],
        }),
      })),
    );

    const adapter = new HttpModerationAdapter({
      MODERATION_PROVIDER: 'custom',
      MODERATION_API_KEY: 'secret',
      MODERATION_API_URL: 'https://moderation.example/review',
    } as NodeJS.ProcessEnv);

    await expect(adapter.autoModerate(revision)).resolves.toEqual({
      decision: 'AUTO_APPROVED',
      riskScore: 0.03,
      findings: [],
    });
  });

  it('maps provider REJECT responses to REJECTED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          action: 'REJECT',
          score: 0.91,
          findings: [{ code: 'policy.prohibited', severity: 'high', detail: 'blocked' }],
        }),
      })),
    );

    const adapter = new HttpModerationAdapter({
      MODERATION_PROVIDER: 'http',
      MODERATION_API_KEY: 'secret',
      MODERATION_API_URL: 'https://moderation.example/review',
    } as NodeJS.ProcessEnv);

    await expect(adapter.autoModerate(revision)).resolves.toEqual({
      decision: 'REJECTED',
      riskScore: 0.91,
      findings: [{ code: 'policy.prohibited', severity: 'high', detail: 'blocked' }],
    });
  });

  it('throws configured error when production keys are missing', async () => {
    const adapter = new HttpModerationAdapter({
      MODERATION_PROVIDER: 'custom',
    } as NodeJS.ProcessEnv);

    await expect(adapter.autoModerate(revision)).rejects.toBeInstanceOf(
      ModerationProviderNotConfiguredError,
    );
  });

  it('falls back to human review on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: 'down' }),
      })),
    );

    const adapter = new HttpModerationAdapter({
      MODERATION_PROVIDER: 'openai',
      MODERATION_API_KEY: 'secret',
    } as NodeJS.ProcessEnv);

    await expect(adapter.autoModerate(revision)).resolves.toMatchObject({
      decision: 'NEEDS_HUMAN',
      findings: [{ code: 'provider.error', severity: 'medium' }],
    });
  });

  it('selects sandbox adapter outside production', async () => {
    const adapter = createModerationAdapter({
      MODERATION_MODE: 'sandbox',
    } as NodeJS.ProcessEnv);

    await expect(adapter.autoModerate(revision)).resolves.toMatchObject({
      decision: 'AUTO_APPROVED',
    });
  });
});
