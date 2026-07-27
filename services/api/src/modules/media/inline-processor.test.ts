import { describe, expect, it } from 'vitest';
import { shouldProcessMediaInline } from './inline-processor';

describe('shouldProcessMediaInline', () => {
  it('enables inline for explicit MEDIA_PROCESSING_MODE', () => {
    expect(shouldProcessMediaInline({ MEDIA_PROCESSING_MODE: 'inline' } as NodeJS.ProcessEnv)).toBe(
      true,
    );
    expect(
      shouldProcessMediaInline({ MEDIA_PROCESSING_MODE: 'sandbox' } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(shouldProcessMediaInline({ MEDIA_PROCESSING_MODE: 'queue' } as NodeJS.ProcessEnv)).toBe(
      false,
    );
  });

  it('defaults to inline on staging', () => {
    expect(shouldProcessMediaInline({ APP_ENV: 'staging' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
