import { describe, expect, it } from 'vitest';
import { canTransitionAdStatus } from '@e3lani/types';

describe('review-before-payment policy', () => {
  it('blocks draft → active shortcut', () => {
    expect(canTransitionAdStatus('DRAFT', 'ACTIVE')).toBe(false);
  });

  it('allows the approved payment path', () => {
    expect(canTransitionAdStatus('DRAFT', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionAdStatus('PENDING_REVIEW', 'APPROVED_AWAITING_PAYMENT')).toBe(true);
    expect(canTransitionAdStatus('APPROVED_AWAITING_PAYMENT', 'PAYMENT_PENDING')).toBe(true);
    expect(canTransitionAdStatus('PAYMENT_PENDING', 'ACTIVE')).toBe(true);
  });
});
