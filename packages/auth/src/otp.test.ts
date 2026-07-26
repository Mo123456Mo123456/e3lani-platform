import { describe, expect, it } from 'vitest';
import { SANDBOX_OTP_CODE, SandboxOtpProvider, createOtpProvider } from './otp';

describe('SandboxOtpProvider', () => {
  it('sends and verifies documented sandbox code', async () => {
    const provider = new SandboxOtpProvider();
    const sent = await provider.sendOtp({
      phone: '+966500000001',
      locale: 'ar',
      correlationId: 'test-1',
    });
    expect(sent.sandboxCode).toBe(SANDBOX_OTP_CODE);
    const result = await provider.verifyOtp({ phone: '+966500000001', code: SANDBOX_OTP_CODE });
    expect(result.valid).toBe(true);
  });

  it('fails closed for production without real keys', () => {
    expect(() => createOtpProvider('production', 'twilio')).toThrow(/not configured/);
  });
});
