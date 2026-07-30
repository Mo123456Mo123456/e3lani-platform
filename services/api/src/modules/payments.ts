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

  async createPayment(input: PaymentIntent): Promise<never> {
    void input;
    return this.unavailable();
  }

  async verifyWebhook(signature: string, rawBody: Buffer): Promise<never> {
    void signature;
    void rawBody;
    return this.unavailable();
  }

  async refund(providerReference: string, amountHalalas: number): Promise<never> {
    void providerReference;
    void amountHalalas;
    return this.unavailable();
  }
}
