import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

import { ads, paymentIntents } from "../../drizzle/schema";
import {
  assertPayableAmount,
  getPaymentProvider,
  paymentStatusForFreePublish,
  type PaymentEnvironment,
} from "../../lib/payments/providers";
import { ENV } from "../_core/env";
import { getDb, getPublicProductConfig, requireDatabase } from "../db";
import { resolveServerPublishQuote } from "../pricing-service";

function publicId() {
  return `pi_${randomBytes(10).toString("hex")}`.slice(0, 32);
}

export async function createPaymentIntentForAd(input: {
  userId: number;
  publicAdId: string;
  countryCode: string;
}) {
  const config = await getPublicProductConfig();
  if (!config.paymentEnabled || !config.launchPolicy?.paymentsEnabled) {
    throw new Error("PAYMENTS_DISABLED");
  }

  const { quote, blockPublishReason, paymentProviderReady } = await resolveServerPublishQuote({
    countryCode: input.countryCode,
    userId: input.userId,
  });

  if (quote.paymentStatus === "not_required" || quote.finalPrice <= 0) {
    return {
      status: paymentStatusForFreePublish(),
      intent: null as null,
      message: "Free publish — no payment intent created.",
    };
  }

  if (blockPublishReason || !paymentProviderReady) {
    throw new Error("PAYMENT_PROVIDER_NOT_READY");
  }

  assertPayableAmount(quote.finalPrice);

  const providerId = config.paymentProvider;
  if (!providerId || providerId === "sandbox") {
    if (ENV.isProduction) throw new Error("SANDBOX_PAYMENT_FORBIDDEN_IN_PRODUCTION");
  }
  const adapter = getPaymentProvider(providerId ?? "sandbox");
  if (!adapter) throw new Error("PAYMENT_PROVIDER_NOT_READY");

  const db = requireDatabase(await getDb());
  const adRows = await db.select().from(ads).where(eq(ads.publicId, input.publicAdId)).limit(1);
  if (!adRows[0]) throw new Error("AD_NOT_FOUND");
  if (adRows[0].ownerId !== input.userId) throw new Error("AD_FORBIDDEN");

  const created = await adapter.createPayment({
    amount: quote.finalPrice,
    currency: quote.currency,
    countryCode: input.countryCode,
    adId: input.publicAdId,
    userId: String(input.userId),
  });

  const environment: PaymentEnvironment = adapter.environment;
  const intentPublicId = publicId();
  const insert = await db.insert(paymentIntents).values({
    publicId: intentPublicId,
    userId: input.userId,
    adId: adRows[0].id,
    provider: adapter.id,
    environment,
    amount: quote.finalPrice,
    currency: quote.currency,
    status: created.status === "not_required" ? "not_required" : "pending",
    externalId: created.externalId,
    clientSecret: created.clientSecret,
    webhookVerified: 0,
    metadata: { quote },
  });

  return {
    status: created.status,
    intent: {
      id: String(insert[0].insertId),
      publicId: intentPublicId,
      externalId: created.externalId,
      clientSecret: created.clientSecret,
      amount: quote.finalPrice,
      currency: quote.currency,
      environment,
    },
    message: created.message,
  };
}

export async function handlePaymentWebhook(input: {
  providerId: string;
  rawBody: string;
  signature: string | null;
  headers: Record<string, string | undefined>;
  externalId: string;
  markPaid: boolean;
}) {
  const adapter = getPaymentProvider(input.providerId);
  if (!adapter) throw new Error("PAYMENT_PROVIDER_NOT_READY");
  const verified = await adapter.verifyWebhook({
    rawBody: input.rawBody,
    signature: input.signature,
    headers: input.headers,
  });
  if (!verified.ok) throw new Error("PAYMENT_WEBHOOK_INVALID");

  const db = requireDatabase(await getDb());
  const intents = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.externalId, input.externalId))
    .limit(1);
  const intent = intents[0];
  if (!intent) throw new Error("PAYMENT_INTENT_NOT_FOUND");

  await db
    .update(paymentIntents)
    .set({
      webhookVerified: 1,
      status: input.markPaid ? "paid" : intent.status,
      paidAt: input.markPaid ? new Date() : intent.paidAt,
    })
    .where(eq(paymentIntents.id, intent.id));

  if (input.markPaid && intent.adId) {
    const now = new Date();
    await db
      .update(ads)
      .set({
        paymentStatus: "paid",
        adStatus: "active",
        activatedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      })
      .where(eq(ads.id, intent.adId));
  }

  return { ok: true as const, eventId: verified.eventId };
}
