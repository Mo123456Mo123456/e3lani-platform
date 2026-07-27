import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { PaymentsProviderService } from './payments-provider.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsProviderService) {}

  /**
   * Sandbox hosted checkout page.
   * Completing this page does NOT activate the ad.
   * It only marks the provider payment paid and shows instructions to fire a signed webhook.
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

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><title>Sandbox Checkout — إعلاني</title>
<style>
body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 16px;background:#f7f7f7;color:#111}
.card{background:#fff;border-radius:16px;padding:24px;line-height:1.7}
.warn{background:#fff8e1;border:1px solid #ffc400;border-radius:12px;padding:12px;margin:16px 0}
code{display:block;white-space:pre-wrap;background:#111;color:#ffc400;padding:12px;border-radius:10px;font-size:12px}
a{color:#111;font-weight:700}
</style></head>
<body>
  <div class="card">
    <h1>Sandbox Checkout</h1>
    <p>تم تسجيل الدفع لدى المزود التجريبي فقط.</p>
    <div class="warn">
      <strong>مهم:</strong> صفحة النجاح/التحويل (<code style="display:inline;padding:2px 6px">redirect</code>)
      <u>لا تنشر الإعلان</u>. التفعيل يتم فقط عبر Webhook موقّع وتحقق خادمي.
    </div>
    <p>orderId: <strong>${orderId}</strong></p>
    <p>providerReference: <strong>${providerReference}</strong></p>
    ${redirect ? `<p>Redirect (لا يفعّل): <a href="${redirect}">${redirect}</a></p>` : ''}
    <h3>مثال Webhook موقّع</h3>
    <code>curl -X POST http://localhost:3001/api/v1/webhooks/payments/sandbox \\
  -H 'content-type: application/json' \\
  -H 'x-e3lani-timestamp: ${timestamp}' \\
  -H 'x-e3lani-signature: ${signature}' \\
  -d '${body.replace(/'/g, "'\\''")}'</code>
  </div>
</body>
</html>`;

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  }
}
