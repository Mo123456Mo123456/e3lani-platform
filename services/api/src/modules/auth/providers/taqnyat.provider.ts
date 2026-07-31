import { Logger } from '@nestjs/common';
import type { OtpProvider, OtpSendResult } from './otp-provider.interface';

/** مزوّد «تقنيات» — https://taqnyat.sa */
export class TaqnyatOtpProvider implements OtpProvider {
  readonly name = 'taqnyat';
  private readonly logger = new Logger('OTP:taqnyat');

  constructor(
    private readonly apiKey: string,
    private readonly sender: string,
  ) {}

  async send(phone: string, code: string): Promise<OtpSendResult> {
    const response = await fetch('https://api.taqnyat.sa/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: [phone],
        body: `رمز الدخول إلى إعلاني: ${code}`,
        sender: this.sender,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`فشل إرسال الرسالة: ${response.status} ${text}`);
      return { delivered: false };
    }
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { delivered: true, providerRef: payload.messageId };
  }
}
