export const AD_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'NEEDS_CHANGES',
  'APPROVED_AWAITING_PAYMENT',
  'PAYMENT_PENDING',
  'PAYMENT_FAILED',
  'APPROVED',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'REJECTED',
  'EXPIRED',
  'REMOVED',
  'REFUNDED',
] as const;

export type AdStatus = (typeof AD_STATUSES)[number];

/**
 * Allowed transitions.
 *
 * FREE_LAUNCH: DRAFT → ACTIVE (direct publish after automated checks only).
 * PAID_ONLY:   DRAFT → PAYMENT_PENDING → ACTIVE (or via APPROVED_AWAITING_PAYMENT).
 * Human review (PENDING_REVIEW) is for post-publish report moderation, not default publish.
 */
export const AD_TRANSITIONS: Record<AdStatus, readonly AdStatus[]> = {
  DRAFT: ['ACTIVE', 'PAYMENT_PENDING', 'APPROVED_AWAITING_PAYMENT', 'PENDING_REVIEW', 'REMOVED'],
  PENDING_REVIEW: ['APPROVED_AWAITING_PAYMENT', 'ACTIVE', 'NEEDS_CHANGES', 'REJECTED', 'PAUSED', 'REMOVED'],
  NEEDS_CHANGES: ['DRAFT', 'PENDING_REVIEW', 'REMOVED'],
  APPROVED_AWAITING_PAYMENT: ['PAYMENT_PENDING', 'SCHEDULED', 'DRAFT', 'REMOVED'],
  PAYMENT_PENDING: ['ACTIVE', 'SCHEDULED', 'PAYMENT_FAILED', 'APPROVED_AWAITING_PAYMENT', 'DRAFT'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'APPROVED_AWAITING_PAYMENT', 'DRAFT', 'REMOVED'],
  APPROVED: ['SCHEDULED', 'ACTIVE', 'REMOVED'],
  SCHEDULED: ['ACTIVE', 'PAUSED', 'REMOVED'],
  ACTIVE: ['PAUSED', 'SCHEDULED', 'EXPIRED', 'REMOVED', 'REFUNDED', 'PENDING_REVIEW'],
  PAUSED: ['ACTIVE', 'EXPIRED', 'REMOVED', 'PENDING_REVIEW'],
  REJECTED: ['DRAFT', 'REMOVED'],
  EXPIRED: ['APPROVED_AWAITING_PAYMENT', 'PAYMENT_PENDING', 'DRAFT', 'REMOVED'],
  REMOVED: [],
  REFUNDED: ['REMOVED'],
};

export function canTransitionAdStatus(from: AdStatus, to: AdStatus): boolean {
  return AD_TRANSITIONS[from].includes(to);
}

export function assertAdTransition(from: AdStatus, to: AdStatus): void {
  if (!canTransitionAdStatus(from, to)) {
    throw new Error(`Invalid ad status transition: ${from} → ${to}`);
  }
}
