import { describe, expect, it } from 'vitest';
import { assertAdTransition, canTransitionAdStatus } from './ad-status';

describe('ad status machine', () => {
  it('requires review before payment', () => {
    expect(canTransitionAdStatus('DRAFT', 'PAYMENT_PENDING')).toBe(false);
    expect(canTransitionAdStatus('DRAFT', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionAdStatus('PENDING_REVIEW', 'APPROVED_AWAITING_PAYMENT')).toBe(true);
    expect(canTransitionAdStatus('APPROVED_AWAITING_PAYMENT', 'PAYMENT_PENDING')).toBe(true);
  });

  it('activates only after payment path', () => {
    expect(canTransitionAdStatus('PAYMENT_PENDING', 'ACTIVE')).toBe(true);
    expect(canTransitionAdStatus('APPROVED_AWAITING_PAYMENT', 'ACTIVE')).toBe(false);
  });

  it('throws on illegal transition', () => {
    expect(() => assertAdTransition('REJECTED', 'ACTIVE')).toThrow(/Invalid ad status/);
  });
});
