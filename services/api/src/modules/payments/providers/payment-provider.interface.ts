export interface CheckoutRequest {
  paymentId: string;
  amountHalalas: number;
  currency: string;
  description: string;
  customer: { id: string; phone: string; name?: string | null; email?: string | null };
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResponse {
  providerRef: string;
  checkoutUrl: string | null;
  /** بيانات إضافية يحتاجها العميل (مثل مفتاح النشر أو معرّف الجلسة) */
  clientData?: Record<string, unknown>;
}

export interface WebhookResult {
  providerRef: string;
  paymentId?: string;
  status: 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED' | 'IGNORED';
  amountHalalas?: number;
  failureReason?: string;
}

/**
 * واجهة مزوّد الدفع (Adapter Pattern).
 * تفعيل الدفع لاحقًا = ضبط متغيّرات البيئة فقط، دون إعادة بناء أي منطق أعمال.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
  parseWebhook(headers: Record<string, any>, rawBody: string): Promise<WebhookResult>;
  refund(providerRef: string, amountHalalas: number): Promise<boolean>;
}
