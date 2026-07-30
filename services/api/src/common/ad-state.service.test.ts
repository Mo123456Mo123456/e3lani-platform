import { describe, expect, it } from 'vitest';
import { canTransitionAdStatus } from '@e3lani/types';

describe('publish policy', () => {
  it('allows FREE_LAUNCH draft → active', () => {
    expect(canTransitionAdStatus('DRAFT', 'ACTIVE')).toBe(true);
  });

  it('allows paid path draft → payment_pending → active', () => {
    expect(canTransitionAdStatus('DRAFT', 'PAYMENT_PENDING')).toBe(true);
    expect(canTransitionAdStatus('PAYMENT_PENDING', 'ACTIVE')).toBe(true);
  });

  it('keeps post-report review path', () => {
    expect(canTransitionAdStatus('DRAFT', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionAdStatus('ACTIVE', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionAdStatus('PENDING_REVIEW', 'APPROVED_AWAITING_PAYMENT')).toBe(true);
    expect(canTransitionAdStatus('APPROVED_AWAITING_PAYMENT', 'PAYMENT_PENDING')).toBe(true);
  });
});
