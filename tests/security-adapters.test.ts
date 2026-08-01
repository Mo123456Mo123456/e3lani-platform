import { afterEach, describe, expect, it } from "vitest";

import {
  generateOtpCode,
  hashOtpCode,
  hashOtpSubject,
  productionOtpAdapter,
} from "../server/otp/providers";
import { sandboxPaymentAdapter } from "../lib/payments/providers";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("OTP provider security", () => {
  it("generates a six-digit code", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("hashes codes and subjects without exposing their source values", () => {
    const codeHash = hashOtpCode("123456");
    const subjectHash = hashOtpSubject("+966500000000");
    expect(codeHash).toHaveLength(64);
    expect(subjectHash).toHaveLength(64);
    expect(codeHash).not.toContain("123456");
    expect(subjectHash).not.toContain("966500000000");
    expect(hashOtpCode("123456")).toBe(codeHash);
  });

  it("fails closed when production provider credentials are absent", async () => {
    delete process.env.OTP_PROVIDER_URL;
    delete process.env.OTP_PROVIDER_API_KEY;
    await expect(
      productionOtpAdapter.sendOtp({
        phone: "+966500000000",
        code: "123456",
        purpose: "login",
      }),
    ).rejects.toThrow("OTP_PROVIDER_NOT_CONFIGURED");
  });
});

describe("payment webhook verification", () => {
  it("derives external id and status from a signed payload", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET = "test-webhook-secret";
    const verified = await sandboxPaymentAdapter.verifyWebhook({
      signature: "test-webhook-secret",
      headers: {},
      rawBody: JSON.stringify({
        eventId: "evt_1",
        externalId: "sandbox_ad_1",
        status: "paid",
      }),
    });
    expect(verified).toEqual({
      ok: true,
      eventId: "evt_1",
      externalId: "sandbox_ad_1",
      status: "paid",
    });
  });

  it("rejects an invalid signature", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET = "expected";
    const verified = await sandboxPaymentAdapter.verifyWebhook({
      signature: "wrong",
      headers: {},
      rawBody: JSON.stringify({ externalId: "sandbox_ad_1", status: "paid" }),
    });
    expect(verified.ok).toBe(false);
  });

  it("rejects client payloads without a valid provider status", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET = "expected";
    const verified = await sandboxPaymentAdapter.verifyWebhook({
      signature: "expected",
      headers: {},
      rawBody: JSON.stringify({ externalId: "sandbox_ad_1", status: "anything" }),
    });
    expect(verified.ok).toBe(false);
  });
});
