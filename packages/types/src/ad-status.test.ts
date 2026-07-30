import { describe, expect, it } from 'vitest';
import { assertAdTransition, canTransitionAdStatus } from './ad-status';

describe('ad status machine', () => {
  it('allows free launch direct publish DRAFT → ACTIVE', () => {
    expect(canTransitionAdStatus('DRAFT', 'ACTIVE')).toBe(true);
  });

  it('allows paid path DRAFT → PAYMENT_PENDING → ACTIVE', () => {
    expect(canTransitionAdStatus('DRAFT', 'PAYMENT_PENDING')).toBe(true);
    expect(canTransitionAdStatus('PAYMENT_PENDING', 'ACTIVE')).toBe(true);
  });

  it('keeps review path for post-report moderation', () => {
    expect(canTransitionAdStatus('DRAFT', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionAdStatus('ACTIVE', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionAdStatus('PENDING_REVIEW', 'ACTIVE')).toBe(true);
    expect(canTransitionAdStatus('PENDING_REVIEW', 'APPROVED_AWAITING_PAYMENT')).toBe(true);
  });

  it('throws on illegal transition', () => {
    expect(() => assertAdTransition('REJECTED', 'ACTIVE')).toThrow(/Invalid ad status/);
  });
});
