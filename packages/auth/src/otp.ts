export type ProviderHealth = {
  healthy: boolean;
  message?: string;
  checkedAt: string;
};

export type SendOtpInput = {
  phone: string;
  locale: 'ar' | 'en';
  correlationId: string;
};

export type SendOtpResult = {
  provider: string;
  requestId: string;
  expiresAt: string;
  /** Present only in sandbox test providers — never real production OTPs. */
  sandboxCode?: string;
};

export type VerifyOtpInput = {
  phone: string;
  code: string;
  requestId?: string;
};

export type VerifyOtpResult = {
  valid: boolean;
  reason?: string;
};

export interface OtpProvider {
  readonly providerName: string;
  sendOtp(input: SendOtpInput): Promise<SendOtpResult>;
  verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult>;
  healthCheck(): Promise<ProviderHealth>;
}

/** Documented sandbox OTP for local/dev — fails closed in production. */
export const SANDBOX_OTP_CODE = '123456';

export class SandboxOtpProvider implements OtpProvider {
  readonly providerName = 'sandbox';
  private readonly codes = new Map<string, { code: string; expiresAt: number }>();

  async sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    this.codes.set(input.phone, { code: SANDBOX_OTP_CODE, expiresAt: expiresAt.getTime() });
    return {
      provider: this.providerName,
      requestId: `sandbox_${input.correlationId}`,
      expiresAt: expiresAt.toISOString(),
      sandboxCode: SANDBOX_OTP_CODE,
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const entry = this.codes.get(input.phone);
    if (!entry) return { valid: false, reason: 'OTP_NOT_FOUND' };
    if (Date.now() > entry.expiresAt) return { valid: false, reason: 'OTP_EXPIRED' };
    if (input.code !== entry.code) return { valid: false, reason: 'OTP_INVALID' };
    this.codes.delete(input.phone);
    return { valid: true };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { healthy: true, message: 'sandbox', checkedAt: new Date().toISOString() };
  }
}

export function createOtpProvider(mode: 'sandbox' | 'production', providerName?: string): OtpProvider {
  if (mode === 'production') {
    throw new Error(
      `Production OTP provider "${providerName ?? 'unset'}" is not configured. Refusing to start with mock success.`,
    );
  }
  return new SandboxOtpProvider();
}
