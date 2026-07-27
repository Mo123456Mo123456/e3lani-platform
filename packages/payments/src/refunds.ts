import type { PaymentProvider, RefundPaymentInput, RefundPaymentResult } from './provider';

export interface RefundPaymentProvider {
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}

export function getRefundProvider(provider: PaymentProvider): RefundPaymentProvider {
  if (typeof provider.refundPayment !== 'function') {
    throw new Error(`Payment provider does not support refunds: ${provider.providerName}`);
  }
  return provider;
}
