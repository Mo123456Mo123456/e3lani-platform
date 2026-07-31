import { Logger } from '@nestjs/common';
import type { OtpProvider, OtpSendResult } from './otp-provider.interface';

/**
 * مزوّد التطوير: يطبع الرمز في سجل الخادم فقط.
 * ممنوع في الإنتاج (يُرفض عند التحقق من متغيرات البيئة)، ولا يظهر للمستخدم إطلاقًا.
 */
export class ConsoleOtpProvider implements OtpProvider {
  readonly name = 'console';
  private readonly logger = new Logger('OTP');

  async send(phone: string, code: string): Promise<OtpSendResult> {
    this.logger.warn(`[تطوير] رمز التحقق للرقم ${phone} هو: ${code}`);
    return { delivered: true, providerRef: `console-${Date.now()}`, debugCode: code };
  }
}
