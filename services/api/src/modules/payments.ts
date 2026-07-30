import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export type PaymentIntent = {
  orderId: string;
  amountHalalas: number;
  currency: "SAR";
  callbackUrl: string;
};

export abstract class PaymentProvider {
  abstract readonly name: string;
  abstract createPayment(input: PaymentIntent): Promise<{ providerReference: string; redirectUrl: string }>;
  abstract verifyWebhook(
    signature: string,
    rawBody: Buffer,
  ): Promise<{ providerReference: string; paid: boolean; raw: unknown }>;
  abstract refund(providerReference: string, amountHalalas: number): Promise<void>;
}

@Injectable()
export class DisabledPaymentAdapter implements PaymentProvider {
  readonly name = "disabled";

  private unavailable(): never {
    throw new ServiceUnavailableException("PAYMENTS_DISABLED");
  }

  async createPayment(): Promise<never> {
    return this.unavailable();
  }

  async verifyWebhook(): Promise<never> {
    return this.unavailable();
  }

  async refund(): Promise<never> {
    return this.unavailable();
  }
}
