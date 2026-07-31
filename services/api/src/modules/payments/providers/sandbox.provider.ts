import { Logger } from '@nestjs/common';
import type {
  CheckoutRequest, CheckoutResponse, PaymentProvider, WebhookResult,
} from './payment-provider.interface';

/**
 * مزوّد تجريبي للتطوير والاختبار فقط.
 * لا يُسمح به إطلاقًا عند NODE_ENV=production (يُرفض في التحقق من متغيرات البيئة)،
 * ولا يُنتج أي «نجاح دفع وهمي» في بيئة الإنتاج.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'sandbox';
  private readonly logger = new Logger('Payments:sandbox');

  constructor(private readonly apiBaseUrl: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('مزوّد الدفع التجريبي ممنوع في بيئة الإنتاج.');
    }
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const providerRef = `sbx_${request.paymentId}`;
    this.logger.warn(`[تطوير] جلسة دفع تجريبية ${providerRef} بقيمة ${request.amountHalalas} هللة`);
    return {
      providerRef,
      checkoutUrl: `${this.apiBaseUrl}/payments/sandbox/${request.paymentId}`,
      clientData: { sandbox: true },
    };
  }

  async parseWebhook(_headers: Record<string, any>, rawBody: string): Promise<WebhookResult> {
    const payload = JSON.parse(rawBody || '{}');
    return {
      providerRef: payload.providerRef ?? '',
      paymentId: payload.paymentId,
      status: payload.status ?? 'IGNORED',
      amountHalalas: payload.amountHalalas,
    };
  }

  async refund(): Promise<boolean> {
    return true;
  }
}
