import { Logger } from '@nestjs/common';
import type { OtpProvider, OtpSendResult } from './otp-provider.interface';

/** مزوّد «يونيفونك» — https://unifonic.com */
export class UnifonicOtpProvider implements OtpProvider {
  readonly name = 'unifonic';
  private readonly logger = new Logger('OTP:unifonic');

  constructor(
    private readonly appSid: string,
    private readonly senderId: string,
  ) {}

  async send(phone: string, code: string): Promise<OtpSendResult> {
    const body = new URLSearchParams({
      AppSid: this.appSid,
      SenderID: this.senderId,
      Recipient: phone,
      Body: `رمز الدخول إلى إعلاني: ${code}`,
    });
    const response = await fetch('https://el.cloud.unifonic.com/rest/SMS/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      this.logger.error(`فشل إرسال الرسالة: ${response.status}`);
      return { delivered: false };
    }
    const payload = (await response.json().catch(() => ({}))) as { data?: { MessageID?: string } };
    return { delivered: true, providerRef: payload?.data?.MessageID };
  }
}
