/**
 * Payment provider adapters — structural readiness for a future paid launch.
 * Providers stay inactive while `paymentsEnabled` / `paymentRequired` are off.
 */

export type PaymentStatus =
  | "not_required"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

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
  status: PaymentStatus;
  externalId: string | null;
  message: string;
};

export interface PaymentProviderAdapter {
  id: string;
  displayName: string;
  supportedCurrencies: string[];
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  confirmPayment(externalId: string): Promise<PaymentResult>;
  refundPayment(externalId: string, amount?: number): Promise<PaymentResult>;
}

/** Sandbox adapter used for local/dev until a real PSP is enabled. */
export const sandboxPaymentAdapter: PaymentProviderAdapter = {
  id: "sandbox",
  displayName: "Sandbox",
  supportedCurrencies: ["SAR", "AED", "EGP", "USD", "GBP"],
  async createPayment(input) {
    if (input.amount <= 0) {
      return {
        provider: "sandbox",
        status: "not_required",
        externalId: null,
        message: "Zero-amount charges are not created.",
      };
    }
    return {
      provider: "sandbox",
      status: "pending",
      externalId: `sandbox_${input.adId}_${Date.now()}`,
      message: "Sandbox payment created; awaiting confirmation.",
    };
  },
  async confirmPayment(externalId) {
    return {
      provider: "sandbox",
      status: "paid",
      externalId,
      message: "Sandbox payment confirmed.",
    };
  },
  async refundPayment(externalId) {
    return {
      provider: "sandbox",
      status: "refunded",
      externalId,
      message: "Sandbox refund recorded.",
    };
  },
};

const registry = new Map<string, PaymentProviderAdapter>([
  [sandboxPaymentAdapter.id, sandboxPaymentAdapter],
]);

export function registerPaymentProvider(adapter: PaymentProviderAdapter) {
  registry.set(adapter.id, adapter);
}

export function getPaymentProvider(id: string | null | undefined): PaymentProviderAdapter | null {
  if (!id) return null;
  return registry.get(id) ?? null;
}

export function listPaymentProviders(): PaymentProviderAdapter[] {
  return [...registry.values()];
}

/** Never treat a free publish as a zero-value paid order. */
export function paymentStatusForFreePublish(): PaymentStatus {
  return "not_required";
}
