import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { DisabledPaymentAdapter } from "./payments";

describe("disabled payment adapter", () => {
  const adapter = new DisabledPaymentAdapter();

  it("never creates a fake successful payment", async () => {
    await expect(
      adapter.createPayment({
        orderId: "order-1",
        amountHalalas: 5900,
        currency: "SAR",
        callbackUrl: "https://example.com/callback",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("does not accept webhooks while disabled", async () => {
    await expect(adapter.verifyWebhook("signature", Buffer.from("{}"))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
