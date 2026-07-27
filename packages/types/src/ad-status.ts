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

/** Allowed transitions. Review always precedes payment. */
export const AD_TRANSITIONS: Record<AdStatus, readonly AdStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'REMOVED'],
  PENDING_REVIEW: ['APPROVED_AWAITING_PAYMENT', 'NEEDS_CHANGES', 'REJECTED', 'REMOVED'],
  NEEDS_CHANGES: ['DRAFT', 'PENDING_REVIEW', 'REMOVED'],
  APPROVED_AWAITING_PAYMENT: ['PAYMENT_PENDING', 'SCHEDULED', 'DRAFT', 'REMOVED'],
  PAYMENT_PENDING: ['ACTIVE', 'SCHEDULED', 'PAYMENT_FAILED', 'APPROVED_AWAITING_PAYMENT'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'APPROVED_AWAITING_PAYMENT', 'REMOVED'],
  APPROVED: ['SCHEDULED', 'ACTIVE', 'REMOVED'],
  SCHEDULED: ['ACTIVE', 'PAUSED', 'REMOVED'],
  ACTIVE: ['PAUSED', 'SCHEDULED', 'EXPIRED', 'REMOVED', 'REFUNDED'],
  PAUSED: ['ACTIVE', 'EXPIRED', 'REMOVED'],
  REJECTED: ['DRAFT', 'REMOVED'],
  EXPIRED: ['APPROVED_AWAITING_PAYMENT', 'DRAFT', 'REMOVED'],
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
