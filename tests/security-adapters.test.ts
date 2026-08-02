import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateOtpCode,
  hashOtpCode,
  hashOtpSubject,
  productionOtpAdapter,
  twilioOtpAdapter,
} from "../server/otp/providers";
import { sandboxPaymentAdapter } from "../lib/payments/providers";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
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

  it("fails closed when production HTTP provider credentials are absent", async () => {
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

  it("fails closed when Twilio credentials are absent", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    await expect(
      twilioOtpAdapter.sendOtp({
        phone: "+966500000000",
        code: "123456",
        purpose: "login",
      }),
    ).rejects.toThrow("TWILIO_OTP_NOT_CONFIGURED");
  });

  it("sends Twilio OTP using server-side basic authentication", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    process.env.TWILIO_FROM_NUMBER = "+15005550006";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ sid: "SMtest" }), { status: 201 }));

    await twilioOtpAdapter.sendOtp({
      phone: "+966500000000",
      code: "654321",
      purpose: "register_advertiser",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/Messages.json");
    expect(options?.headers).toMatchObject({
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(String(options?.body)).toContain("To=%2B966500000000");
    expect(String(options?.body)).toContain("654321");
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
