import { describe, expect, it } from 'vitest';
import { SandboxPaymentProvider } from './sandbox-provider';
import { getRefundProvider } from './refunds';
import { ProductionPaymentProviderStub } from './providers/production-stub';

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

describe('payment refunds', () => {
  it('refunds sandbox payments and updates status', async () => {
    const provider = new SandboxPaymentProvider('test-secret', 'http://localhost:3001');
    const checkout = await provider.createCheckout({
      orderId: 'order_1',
      amount: 19,
      currency: 'SAR',
      countryCode: 'SA',
      channel: 'hosted_checkout',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
      metadata: {},
      idempotencyKey: 'order_1:create',
    });
    provider.markPaid(checkout.providerReference);

    const refundProvider = getRefundProvider(provider);
    const refund = await refundProvider.refundPayment({
      providerReference: checkout.providerReference,
      amount: 19,
      reason: 'test refund',
      idempotencyKey: 'order_1:refund',
    });

    await expect(
      provider.getPaymentStatus({ providerReference: checkout.providerReference }),
    ).resolves.toEqual({ status: 'refunded', paid: false });
    expect(refund.status).toBe('refunded');
    expect(refund.refundId).toMatch(/^sandbox_refund_/);
  });

  it('refuses production payment operations without provider keys', async () => {
    const provider = new ProductionPaymentProviderStub({
      providerName: 'moyasar',
      mode: 'production',
      env: {},
    });

    await expect(
      provider.createCheckout({
        orderId: 'order_1',
        amount: 19,
        currency: 'SAR',
        countryCode: 'SA',
        channel: 'hosted_checkout',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel',
        metadata: {},
        idempotencyKey: 'order_1:create',
      }),
    ).rejects.toThrow(/PAYMENT_PROVIDER_NOT_CONFIGURED:moyasar/);
    await expect(
      provider.refundPayment({
        providerReference: 'pay_1',
        amount: 19,
        idempotencyKey: 'order_1:refund',
      }),
    ).rejects.toThrow(/PAYMENT_PROVIDER_NOT_CONFIGURED:moyasar/);
    await expect(provider.verifyWebhookSignature({ headers: {}, rawBody: '{}' })).resolves.toBe(
      false,
    );
  });
});
