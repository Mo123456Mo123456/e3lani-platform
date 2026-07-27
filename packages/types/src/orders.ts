export const ORDER_STATUSES = [
  'CREATED',
  'PENDING_PAYMENT',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'DISPUTED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PaymentChannel =
  | 'hosted_checkout'
  | 'apple_iap'
  | 'google_play'
  | 'bank_transfer'
  | 'paypal';

export type PaymentMode = 'sandbox' | 'production';
