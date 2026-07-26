export const MODERATION_STATUSES = [
  'NOT_SUBMITTED',
  'QUEUED',
  'AUTO_APPROVED',
  'NEEDS_HUMAN',
  'APPROVED',
  'REJECTED',
  'NEEDS_CHANGES',
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  'NOT_REQUESTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const REPORT_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'ACTION_TAKEN',
  'NO_VIOLATION',
  'CLOSED',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
