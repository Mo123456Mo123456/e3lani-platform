import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

import { ads, paymentIntents } from "../../drizzle/schema";
import {
  assertPayableAmount,
  getPaymentProvider,
  paymentStatusForFreePublish,
  type PaymentEnvironment,
  type PaymentStatus,
} from "../../lib/payments/providers";
import { ENV } from "../_core/env";
import { getDb, getPublicProductConfig, requireDatabase } from "../db";
import { resolveServerPublishQuote } from "../pricing-service";

function publicId() {
  return `pi_${randomBytes(10).toString("hex")}`.slice(0, 32);
}

function paymentIdempotencyKey(input: {
  userId: number;
  publicAdId: string;
  providerId: string;
  amount: number;
  currency: string;
}) {
  const source = [
    "payment-intent-v1",
    input.userId,
    input.publicAdId,
    input.providerId,
    input.amount,
    input.currency.toUpperCase(),
  ].join(":");
  return createHash("sha256").update(source).digest("hex");
}

function intentResult(intent: typeof paymentIntents.$inferSelect, message: string) {
  return {
    status: intent.status,
    intent: {
      id: String(intent.id),
      publicId: intent.publicId,
      externalId: intent.externalId,
      clientSecret: intent.clientSecret,
      amount: intent.amount,
      currency: intent.currency,
      environment: intent.environment,
    },
    message,
  };
}

async function findIntentByIdempotencyKey(idempotencyKey: string) {
  const db = requireDatabase(await getDb());
  const rows = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.idempotencyKey, idempotencyKey))
    .limit(1);
  return rows[0] ?? null;
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
  const ad = adRows[0];
  if (!ad) throw new Error("AD_NOT_FOUND");
  if (ad.ownerId !== input.userId) throw new Error("AD_FORBIDDEN");

  const environment: PaymentEnvironment = adapter.environment;
  const idempotencyKey = paymentIdempotencyKey({
    userId: input.userId,
    publicAdId: input.publicAdId,
    providerId: adapter.id,
    amount: quote.finalPrice,
    currency: quote.currency,
  });
  const existing = await findIntentByIdempotencyKey(idempotencyKey);
  if (existing) {
    return intentResult(existing, "Existing idempotent payment intent returned.");
  }

  const intentPublicId = publicId();
  let reservedId: number;
  try {
    const reserved = await db.insert(paymentIntents).values({
      publicId: intentPublicId,
      idempotencyKey,
      userId: input.userId,
      adId: ad.id,
      provider: adapter.id,
      environment,
      amount: quote.finalPrice,
      currency: quote.currency,
      status: "processing",
      externalId: null,
      clientSecret: null,
      webhookVerified: 0,
      metadata: { quote, phase: "provider_request" },
    });
    reservedId = Number(reserved[0].insertId);
  } catch (error) {
    // A concurrent request may have reserved the same idempotency key.
    const concurrent = await findIntentByIdempotencyKey(idempotencyKey);
    if (concurrent) {
      return intentResult(concurrent, "Concurrent idempotent payment intent returned.");
    }
    throw error;
  }

  try {
    const created = await adapter.createPayment({
      amount: quote.finalPrice,
      currency: quote.currency,
      countryCode: input.countryCode,
      adId: input.publicAdId,
      userId: String(input.userId),
      metadata: { idempotencyKey, intentPublicId },
    });

    if (!created.externalId || created.status === "not_required") {
      throw new Error("PAYMENT_PROVIDER_INVALID_RESPONSE");
    }

    await db
      .update(paymentIntents)
      .set({
        status: created.status,
        externalId: created.externalId,
        clientSecret: created.clientSecret,
        metadata: { quote, phase: "provider_created" },
      })
      .where(eq(paymentIntents.id, reservedId));

    const rows = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, reservedId))
      .limit(1);
    const saved = rows[0];
    if (!saved) throw new Error("PAYMENT_INTENT_NOT_FOUND");
    return intentResult(saved, created.message);
  } catch (error) {
    await db
      .update(paymentIntents)
      .set({
        status: "failed",
        metadata: {
          quote,
          phase: "provider_failed",
          error: error instanceof Error ? error.message : "PAYMENT_PROVIDER_FAILED",
        },
      })
      .where(eq(paymentIntents.id, reservedId));
    throw error;
  }
}

function transitionAllowed(current: PaymentStatus, next: PaymentStatus): boolean {
  if (current === next) return true;
  if (current === "refunded") return false;
  if (current === "cancelled" || current === "failed") return false;
  if (current === "paid") {
    return next === "refunded" || next === "partially_refunded";
  }
  if (current === "partially_refunded") {
    return next === "refunded";
  }
  return next !== "not_required";
}

function adPaymentStatus(status: PaymentStatus) {
  if (status === "cancelled") return "failed" as const;
  if (status === "processing") return "pending" as const;
  if (status === "not_required") return "not_required" as const;
  return status;
}

export async function handlePaymentWebhook(input: {
  providerId: string;
  rawBody: string;
  signature: string | null;
  headers: Record<string, string | undefined>;
  /** Legacy client fields are deliberately ignored. */
  externalId?: string;
  markPaid?: boolean;
}) {
  const adapter = getPaymentProvider(input.providerId);
  if (!adapter) throw new Error("PAYMENT_PROVIDER_NOT_READY");

  const verified = await adapter.verifyWebhook({
    rawBody: input.rawBody,
    signature: input.signature,
    headers: input.headers,
  });
  if (!verified.ok || !verified.externalId || !verified.status) {
    throw new Error("PAYMENT_WEBHOOK_INVALID");
  }

  const db = requireDatabase(await getDb());
  const intents = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.externalId, verified.externalId))
    .limit(1);
  const intent = intents[0];
  if (!intent) throw new Error("PAYMENT_INTENT_NOT_FOUND");
  if (intent.provider !== adapter.id || intent.environment !== adapter.environment) {
    throw new Error("PAYMENT_WEBHOOK_PROVIDER_MISMATCH");
  }

  const currentStatus = intent.status as PaymentStatus;
  const nextStatus = verified.status;
  if (currentStatus === nextStatus) {
    return { ok: true as const, eventId: verified.eventId, deduped: true as const };
  }
  if (!transitionAllowed(currentStatus, nextStatus)) {
    throw new Error("PAYMENT_STATUS_TRANSITION_INVALID");
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(paymentIntents)
      .set({
        webhookVerified: 1,
        status: nextStatus,
        paidAt: nextStatus === "paid" ? now : intent.paidAt,
        metadata: {
          ...(intent.metadata && typeof intent.metadata === "object" ? intent.metadata : {}),
          lastWebhookEventId: verified.eventId,
          lastWebhookStatus: nextStatus,
        },
      })
      .where(eq(paymentIntents.id, intent.id));

    if (!intent.adId) return;

    if (nextStatus === "paid") {
      await tx
        .update(ads)
        .set({
          paymentStatus: "paid",
          adStatus: "active",
          activatedAt: now,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        })
        .where(eq(ads.id, intent.adId));
      return;
    }

    if (nextStatus === "refunded") {
      await tx
        .update(ads)
        .set({ paymentStatus: "refunded", adStatus: "paused", pausedAt: now })
        .where(eq(ads.id, intent.adId));
      return;
    }

    if (nextStatus === "partially_refunded") {
      await tx
        .update(ads)
        .set({ paymentStatus: "partially_refunded" })
        .where(eq(ads.id, intent.adId));
      return;
    }

    await tx
      .update(ads)
      .set({ paymentStatus: adPaymentStatus(nextStatus) })
      .where(eq(ads.id, intent.adId));
  });

  return { ok: true as const, eventId: verified.eventId, deduped: false as const };
}
