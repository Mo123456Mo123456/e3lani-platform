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

function otpHashSecret(): string {
  if (ENV.cookieSecret) return ENV.cookieSecret;
  if (!ENV.isProduction) return "e3lani-local-sandbox-only-secret";
  throw new Error("OTP_HASH_SECRET_NOT_CONFIGURED");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(`${otpHashSecret()}:otp:${code}`).digest("hex");
}

export function hashOtpSubject(phone: string): string {
  return createHash("sha256")
    .update(`${otpHashSecret()}:otp-subject:${phone.trim()}`)
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

/**
 * Twilio Programmable Messaging adapter.
 *
 * Required environment variables:
 * - OTP_PROVIDER=twilio
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID
 *
 * Credentials stay server-side and are never returned to the client.
 */
export const twilioOtpAdapter: OtpProviderAdapter = {
  id: "twilio",
  async sendOtp(input) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
      throw new Error("TWILIO_OTP_NOT_CONFIGURED");
    }
    if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
      throw new Error("TWILIO_ACCOUNT_SID_INVALID");
    }
    if (fromNumber && !/^\+[1-9]\d{7,14}$/.test(fromNumber)) {
      throw new Error("TWILIO_FROM_NUMBER_INVALID");
    }
    if (messagingServiceSid && !/^MG[0-9a-fA-F]{32}$/.test(messagingServiceSid)) {
      throw new Error("TWILIO_MESSAGING_SERVICE_SID_INVALID");
    }

    const form = new URLSearchParams({
      To: input.phone,
      Body: `E3lani verification code: ${input.code}. Expires in 5 minutes.`,
    });
    if (messagingServiceSid) {
      form.set("MessagingServiceSid", messagingServiceSid);
    } else if (fromNumber) {
      form.set("From", fromNumber);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const credentials = Buffer.from(`${accountSid}:${authToken}`, "utf8").toString("base64");

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            authorization: `Basic ${credentials}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`TWILIO_OTP_SEND_FAILED_${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("TWILIO_OTP_TIMEOUT");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
};

export function getOtpProvider(): OtpProviderAdapter {
  if (!ENV.isProduction) {
    return sandboxOtpAdapter;
  }

  const provider = process.env.OTP_PROVIDER?.trim().toLowerCase();
  if (provider === "twilio") return twilioOtpAdapter;
  if (!provider || provider === "http") return productionOtpAdapter;
  throw new Error(`OTP_PROVIDER_UNSUPPORTED_${provider}`);
}

export function isOtpSandboxMode(): boolean {
  return !ENV.isProduction;
}

/** Fixed sandbox code accepted only outside production. */
export const SANDBOX_OTP_CODE = "123456";
