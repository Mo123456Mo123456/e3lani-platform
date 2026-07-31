import { Logger } from '@nestjs/common';
import type { OtpProvider, OtpSendResult } from './otp-provider.interface';

/** مزوّد «مسجات» — https://msegat.com */
export class MsegatOtpProvider implements OtpProvider {
  readonly name = 'msegat';
  private readonly logger = new Logger('OTP:msegat');

  constructor(
    private readonly username: string,
    private readonly apiKey: string,
    private readonly sender: string,
  ) {}

  async send(phone: string, code: string): Promise<OtpSendResult> {
    const response = await fetch('https://www.msegat.com/gw/sendsms.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: this.username,
        apiKey: this.apiKey,
        numbers: phone,
        userSender: this.sender,
        msg: `رمز الدخول إلى إعلاني: ${code}`,
      }),
    });
    if (!response.ok) {
      this.logger.error(`فشل إرسال الرسالة: ${response.status}`);
      return { delivered: false };
    }
    return { delivered: true };
  }
}
