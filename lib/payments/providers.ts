/**
 * Payment provider adapters — ready for a future paid launch.
 * Sandbox must never run in production.
 */

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export type PaymentStatus =
  | "not_required"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type PaymentEnvironment = "sandbox" | "production";

export type CreatePaymentInput = {
  amount: number;
  currency: string;
  countryCode: string;
  adId: string;
  userId: string;
  metadata?: Record<string, string>;
};

export type PaymentResult = {
  provider: string;
  environment: PaymentEnvironment;
  status: PaymentStatus;
  externalId: string | null;
  clientSecret: string | null;
  message: string;
};

export type WebhookVerificationInput = {
  rawBody: string;
  signature: string | null;
  headers: Record<string, string | undefined>;
};

export type WebhookVerificationResult = {
  ok: boolean;
  eventId: string | null;
  externalId: string | null;
  status: PaymentStatus | null;
};

export interface PaymentProviderAdapter {
  id: string;
  displayName: string;
  environment: PaymentEnvironment;
  supportedCurrencies: string[];
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  confirmPayment(externalId: string): Promise<PaymentResult>;
  refundPayment(externalId: string, amount?: number): Promise<PaymentResult>;
  verifyWebhook(input: WebhookVerificationInput): Promise<WebhookVerificationResult>;
}

const PAYMENT_STATUSES = new Set<PaymentStatus>([
  "not_required",
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

function parsePaymentStatus(value: unknown): PaymentStatus | null {
  return typeof value === "string" && PAYMENT_STATUSES.has(value as PaymentStatus)
    ? (value as PaymentStatus)
    : null;
}

export const sandboxPaymentAdapter: PaymentProviderAdapter = {
  id: "sandbox",
  displayName: "Sandbox",
  environment: "sandbox",
  supportedCurrencies: ["SAR", "AED", "EGP", "USD", "GBP"],
  async createPayment(input) {
    if (isProductionRuntime()) {
      throw new Error("SANDBOX_PAYMENT_FORBIDDEN_IN_PRODUCTION");
    }
    if (input.amount <= 0) {
      return {
        provider: "sandbox",
        environment: "sandbox",
        status: "not_required",
        externalId: null,
        clientSecret: null,
        message: "Zero-amount charges are not created.",
      };
    }
    return {
      provider: "sandbox",
      environment: "sandbox",
      status: "pending",
      externalId: `sandbox_${input.adId}_${Date.now()}`,
      clientSecret: `sandbox_secret_${input.adId}`,
      message: "Sandbox payment intent created.",
    };
  },
  async confirmPayment(externalId) {
    if (isProductionRuntime()) throw new Error("SANDBOX_PAYMENT_FORBIDDEN_IN_PRODUCTION");
    return {
      provider: "sandbox",
      environment: "sandbox",
      status: "paid",
      externalId,
      clientSecret: null,
      message: "Sandbox payment confirmed.",
    };
  },
  async refundPayment(externalId) {
    if (isProductionRuntime()) throw new Error("SANDBOX_PAYMENT_FORBIDDEN_IN_PRODUCTION");
    return {
      provider: "sandbox",
      environment: "sandbox",
      status: "refunded",
      externalId,
      clientSecret: null,
      message: "Sandbox refund recorded.",
    };
  },
  async verifyWebhook(input) {
    if (isProductionRuntime()) throw new Error("SANDBOX_PAYMENT_FORBIDDEN_IN_PRODUCTION");
    const expectedSignature =
      process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET?.trim() || "e3lani-sandbox-webhook-secret";
    if (input.signature !== expectedSignature) {
      return { ok: false, eventId: null, externalId: null, status: null };
    }

    try {
      const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
      const externalId = typeof payload.externalId === "string" ? payload.externalId.trim() : "";
      const status = parsePaymentStatus(payload.status);
      const eventId =
        typeof payload.eventId === "string" && payload.eventId.trim()
          ? payload.eventId.trim()
          : `sandbox_evt_${Date.now()}`;
      if (!externalId || !status || status === "not_required") {
        return { ok: false, eventId: null, externalId: null, status: null };
      }
      return { ok: true, eventId, externalId, status };
    } catch {
      return { ok: false, eventId: null, externalId: null, status: null };
    }
  },
};

/** Production stub — activate after provider credentials are configured. */
export const productionPaymentAdapter: PaymentProviderAdapter = {
  id: "production",
  displayName: "Production PSP",
  environment: "production",
  supportedCurrencies: ["SAR", "AED", "EGP", "USD", "GBP"],
  async createPayment() {
    throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED");
  },
  async confirmPayment() {
    throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED");
  },
  async refundPayment() {
    throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED");
  },
  async verifyWebhook() {
    throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED");
  },
};

const registry = new Map<string, PaymentProviderAdapter>([
  [sandboxPaymentAdapter.id, sandboxPaymentAdapter],
  [productionPaymentAdapter.id, productionPaymentAdapter],
]);

export function registerPaymentProvider(adapter: PaymentProviderAdapter) {
  registry.set(adapter.id, adapter);
}

export function getPaymentProvider(id: string | null | undefined): PaymentProviderAdapter | null {
  if (!id) return null;
  const adapter = registry.get(id) ?? null;
  if (adapter?.environment === "sandbox" && isProductionRuntime()) return null;
  return adapter;
}

export function listPaymentProviders(): PaymentProviderAdapter[] {
  return [...registry.values()].filter(
    (adapter) => !(adapter.environment === "sandbox" && isProductionRuntime()),
  );
}

export function paymentStatusForFreePublish(): PaymentStatus {
  return "not_required";
}

export function assertPayableAmount(amount: number) {
  if (amount <= 0) {
    throw new Error("ZERO_AMOUNT_PAYMENT_FORBIDDEN");
  }
}
