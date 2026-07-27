import { describe, expect, it } from 'vitest';
import { SandboxPaymentProvider } from './sandbox-provider';

describe('SandboxPaymentProvider webhook security', () => {
  const provider = new SandboxPaymentProvider('test-secret', 'http://localhost:3001');

  it('accepts valid signature inside replay window', async () => {
    const body = JSON.stringify({
      eventId: 'evt_1',
      type: 'payment.paid',
      providerReference: 'sandbox_pay_1',
      orderId: 'order_1',
      paid: true,
    });
    const timestamp = String(Date.now());
    const signature = provider.signPayload(body, timestamp);
    const ok = await provider.verifyWebhookSignature({
      headers: {
        'x-e3lani-signature': signature,
        'x-e3lani-timestamp': timestamp,
      },
      rawBody: body,
    });
    expect(ok).toBe(true);
  });

  it('rejects missing or wrong signature', async () => {
    const body = '{"eventId":"evt_2","providerReference":"x","orderId":"y","paid":true}';
    const ok = await provider.verifyWebhookSignature({
      headers: {
        'x-e3lani-signature': 'deadbeef',
        'x-e3lani-timestamp': String(Date.now()),
      },
      rawBody: body,
    });
    expect(ok).toBe(false);
  });
});
