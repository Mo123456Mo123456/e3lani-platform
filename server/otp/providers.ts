import { createHash, randomInt } from "crypto";

import { ENV } from "../_core/env";

export type OtpPurpose = "login" | "register_advertiser";

export type OtpSendResult = {
  provider: string;
  challengeId: string;
  expiresAt: string;
  /** Only returned in non-production sandbox adapters for local testing. */
  sandboxCode?: string;
};

export interface OtpProviderAdapter {
  id: string;
  sendOtp(input: { phone: string; code: string; purpose: OtpPurpose }): Promise<void>;
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(`${ENV.cookieSecret}:otp:${code}`).digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

/** Sandbox SMS — never used as a production delivery channel. */
export const sandboxOtpAdapter: OtpProviderAdapter = {
  id: "sandbox",
  async sendOtp() {
    // Intentionally no external delivery.
  },
};

/** Placeholder for a real SMS/WhatsApp provider; wire credentials via env later. */
export const productionOtpAdapter: OtpProviderAdapter = {
  id: "production",
  async sendOtp(input) {
    if (!process.env.OTP_PROVIDER_API_KEY) {
      throw new Error("OTP_PROVIDER_NOT_CONFIGURED");
    }
    // Provider HTTP call would go here.
    void input;
    throw new Error("OTP_PROVIDER_NOT_CONFIGURED");
  },
};

export function getOtpProvider(): OtpProviderAdapter {
  if (ENV.isProduction) {
    return productionOtpAdapter;
  }
  return sandboxOtpAdapter;
}

export function isOtpSandboxMode(): boolean {
  return !ENV.isProduction;
}

/** Fixed sandbox code accepted only outside production. */
export const SANDBOX_OTP_CODE = "123456";
