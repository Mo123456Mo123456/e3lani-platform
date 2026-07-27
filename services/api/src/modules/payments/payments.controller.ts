import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { apiPublicBaseUrl } from '@e3lani/storage';
import { PaymentsProviderService } from './payments-provider.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsProviderService) {}

  /**
   * Sandbox hosted checkout.
   * Redirect never activates ads. This page marks the provider payment paid,
   * then delivers a signed webhook to the API (server-side) which alone activates.
   */
  @Get('sandbox/checkout')
  async sandboxCheckout(
    @Query('orderId') orderId: string,
    @Query('ref') providerReference: string,
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    const sandbox = this.payments.getSandbox();
    sandbox.markPaid(providerReference);

    const payload = {
      eventId: `evt_${randomUUID()}`,
      type: 'payment.paid',
      providerReference,
      orderId,
      paid: true,
      occurredAt: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const signature = sandbox.signPayload(body, timestamp);
    const apiBase = apiPublicBaseUrl();

    let webhookResult = 'pending';
    try {
      const wh = await fetch(`${apiBase}/api/v1/webhooks/payments/sandbox`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-e3lani-timestamp': timestamp,
          'x-e3lani-signature': signature,
        },
        body,
      });
      webhookResult = `${wh.status} ${await wh.text()}`;
    } catch (error) {
      webhookResult = `failed: ${(error as Error).message}`;
    }

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><title>Sandbox Checkout — إعلاني</title>
<style>
body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 16px;background:#f7f7f7;color:#111}
.card{background:#fff;border-radius:16px;padding:24px;line-height:1.7}
.warn{background:#fff8e1;border:1px solid #ffc400;border-radius:12px;padding:12px;margin:16px 0}
code{display:block;white-space:pre-wrap;background:#111;color:#ffc400;padding:12px;border-radius:10px;font-size:12px;margin-top:8px}
a.btn{display:inline-flex;margin-top:12px;padding:12px 18px;border-radius:12px;background:#ffc400;color:#111;font-weight:800;text-decoration:none}
</style></head>
<body>
  <div class="card">
    <h1>Sandbox Checkout</h1>
    <div class="warn">
      <strong>مهم:</strong> صفحة التحويل/النجاح لا تنشر الإعلان.
      التفعيل تم عبر Webhook موقّع وتحقق خادمي فقط.
    </div>
    <p>orderId: <strong>${orderId}</strong></p>
    <p>providerReference: <strong>${providerReference}</strong></p>
    <p>Webhook result:</p>
    <code>${webhookResult.replace(/</g, '&lt;')}</code>
    ${redirect ? `<a class="btn" href="${redirect}">متابعة (Redirect لا يفعّل)</a>` : ''}
  </div>
</body>
</html>`;

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  }
}
