import { createHmac } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoyasarPaymentProvider } from './moyasar-provider';

const env: NodeJS.ProcessEnv = {
  MOYASAR_SECRET_KEY: 'sk_test_123',
  MOYASAR_PUBLISHABLE_KEY: 'pk_test_123',
  MOYASAR_WEBHOOK_SECRET: 'whsec_123',
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

function checkoutInput() {
  return {
    orderId: 'order_1',
    amount: 59,
    currency: 'SAR' as const,
    countryCode: 'SA',
    channel: 'hosted_checkout' as const,
    successUrl: 'https://merchant.example/success',
    cancelUrl: 'https://merchant.example/cancel',
    metadata: { adId: 'ad_1' },
    idempotencyKey: 'order_1:create',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MoyasarPaymentProvider', () => {
  it('throws a not-configured error when checkout keys are missing', async () => {
    const provider = new MoyasarPaymentProvider({ env: {} });

    await expect(provider.createCheckout(checkoutInput())).rejects.toThrow(
      /PAYMENT_PROVIDER_NOT_CONFIGURED:moyasar:missing/,
    );
  });

  it('verifies valid HMAC webhook signatures and rejects invalid signatures', async () => {
    const provider = new MoyasarPaymentProvider({ env });
    const body = JSON.stringify({ id: 'evt_1', data: { id: 'pay_1', status: 'paid' } });
    const signature = createHmac('sha256', env.MOYASAR_WEBHOOK_SECRET!).update(body).digest('hex');

    await expect(
      provider.verifyWebhookSignature({
        headers: { 'X-Moyasar-Signature': signature },
        rawBody: body,
      }),
    ).resolves.toBe(true);

    await expect(
      provider.verifyWebhookSignature({
        headers: { 'x-moyasar-signature': 'invalid-signature' },
        rawBody: body,
      }),
    ).resolves.toBe(false);
  });

  it('maps a paid Moyasar webhook event', async () => {
    const provider = new MoyasarPaymentProvider({ env });
    const occurredAt = '2026-07-27T18:00:00.000Z';
    const body = JSON.stringify({
      id: 'evt_1',
      type: 'payment.paid',
      data: {
        id: 'pay_1',
        status: 'paid',
        updated_at: occurredAt,
        metadata: { orderId: 'order_1' },
      },
    });

    await expect(provider.parseWebhook({ headers: {}, rawBody: body })).resolves.toEqual({
      eventId: 'evt_1',
      type: 'payment.paid',
      providerReference: 'pay_1',
      orderId: 'order_1',
      paid: true,
      occurredAt,
    });
  });

  it('refunds a Moyasar payment with mocked fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'refund_1', status: 'refunded' }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new MoyasarPaymentProvider({ env });

    await expect(
      provider.refundPayment({
        providerReference: 'pay_1',
        amount: 5,
        reason: 'customer request',
        idempotencyKey: 'order_1:refund',
      }),
    ).resolves.toEqual({ refundId: 'refund_1', status: 'refunded' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.moyasar.com/v1/payments/pay_1/refund',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amount: 500, reason: 'customer request' }),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
    expect(request.headers.Authorization).toBe(`Basic ${Buffer.from('sk_test_123:').toString('base64')}`);
    expect(request.headers['Idempotency-Key']).toBe('order_1:refund');
  });

  it('creates checkout and returns the Moyasar provider reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'pay_1',
        status: 'initiated',
        source: { transaction_url: 'https://payments.example/3ds' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new MoyasarPaymentProvider({ env });

    await expect(provider.createCheckout(checkoutInput())).resolves.toMatchObject({
      provider: 'moyasar',
      providerReference: 'pay_1',
      checkoutUrl: 'https://payments.example/3ds',
    });

    const request = fetchMock.mock.calls[0]?.[1] as { body: string; headers: Record<string, string> };
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.moyasar.com/v1/payments',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(request.body)).toEqual({
      amount: 5900,
      currency: 'SAR',
      description: 'E3lani order order_1',
      callback_url: 'https://merchant.example/success',
      source: { type: 'creditcard' },
      metadata: {
        adId: 'ad_1',
        orderId: 'order_1',
        idempotencyKey: 'order_1:create',
        publishableKey: 'pk_test_123',
      },
    });
    expect(request.headers['Idempotency-Key']).toBe('order_1:create');
  });
});
