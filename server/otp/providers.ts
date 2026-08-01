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
  if (!ENV.cookieSecret) {
    throw new Error("OTP_HASH_SECRET_NOT_CONFIGURED");
  }
  return createHash("sha256").update(`${ENV.cookieSecret}:otp:${code}`).digest("hex");
}

export function hashOtpSubject(phone: string): string {
  if (!ENV.cookieSecret) {
    throw new Error("OTP_HASH_SECRET_NOT_CONFIGURED");
  }
  return createHash("sha256")
    .update(`${ENV.cookieSecret}:otp-subject:${phone.trim()}`)
    .digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Sandbox SMS — never used as a production delivery channel. */
export const sandboxOtpAdapter: OtpProviderAdapter = {
  id: "sandbox",
  async sendOtp() {
    // Intentionally no external delivery.
  },
};

/**
 * Generic production HTTP adapter.
 *
 * Required environment variables:
 * - OTP_PROVIDER_URL
 * - OTP_PROVIDER_API_KEY
 *
 * Optional:
 * - OTP_PROVIDER_SENDER (defaults to E3lani)
 * - OTP_PROVIDER_AUTH_HEADER (defaults to Authorization)
 * - OTP_PROVIDER_AUTH_SCHEME (defaults to Bearer)
 *
 * The endpoint receives JSON: { to, code, purpose, sender }.
 * A provider-specific adapter can replace this implementation later without
 * changing the OTP service contract.
 */
export const productionOtpAdapter: OtpProviderAdapter = {
  id: "production-http",
  async sendOtp(input) {
    const url = process.env.OTP_PROVIDER_URL?.trim();
    const apiKey = process.env.OTP_PROVIDER_API_KEY?.trim();
    if (!url || !apiKey) {
      throw new Error("OTP_PROVIDER_NOT_CONFIGURED");
    }

    const authHeader = process.env.OTP_PROVIDER_AUTH_HEADER?.trim() || "Authorization";
    const authScheme = process.env.OTP_PROVIDER_AUTH_SCHEME?.trim() ?? "Bearer";
    const authValue = authScheme ? `${authScheme} ${apiKey}` : apiKey;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [authHeader]: authValue,
        },
        body: JSON.stringify({
          to: input.phone,
          code: input.code,
          purpose: input.purpose,
          sender: process.env.OTP_PROVIDER_SENDER?.trim() || "E3lani",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OTP_PROVIDER_SEND_FAILED_${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("OTP_PROVIDER_TIMEOUT");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
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
