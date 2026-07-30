import {
  Body,
  Controller,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { Post } from "@nestjs/common";
import { parseServerEnv } from "@e3lani/config";
import { prisma } from "@e3lani/database";
import { CurrentUser, type AuthUser } from "./common";

const env = parseServerEnv();

export interface PaymentIntent {
  providerId: string;
  checkoutUrl: string;
}

export interface PaymentProvider {
  createIntent(orderId: string, amountHalalas: number): Promise<PaymentIntent>;
  verifyWebhook(signature: string, payload: Buffer): Promise<boolean>;
}

@Injectable()
export class DisabledPaymentProvider implements PaymentProvider {
  async createIntent(_orderId: string, _amountHalalas: number): Promise<PaymentIntent> {
    throw new ServiceUnavailableException("PAYMENTS_DISABLED");
  }

  async verifyWebhook(): Promise<boolean> {
    return false;
  }
}

@Injectable()
export class PaymentsService {
  constructor(private readonly provider: DisabledPaymentProvider) {}

  async createOrder(
    userId: string,
    input: { priceCodes?: string[]; adId?: string; idempotencyKey?: string }
  ) {
    if (!env.PAYMENTS_ENABLED || env.PAYMENT_PROVIDER === "disabled") {
      throw new ServiceUnavailableException("PAYMENTS_DISABLED");
    }
    if (!input.idempotencyKey || !input.priceCodes?.length) {
      throw new ServiceUnavailableException("PAYMENT_REQUEST_INVALID");
    }
    const prices = await prisma.price.findMany({
      where: { code: { in: input.priceCodes }, active: true }
    });
    if (prices.length !== new Set(input.priceCodes).size) {
      throw new ServiceUnavailableException("PRICE_NOT_AVAILABLE");
    }
    const totalHalalas = prices.reduce((sum, item) => sum + item.amountHalalas, 0);
    const order = await prisma.paymentOrder.create({
      data: {
        userId,
        status: "PENDING",
        totalHalalas,
        provider: env.PAYMENT_PROVIDER,
        idempotencyKey: input.idempotencyKey,
        items: {
          create: prices.map((price) => ({
            priceCode: price.code,
            amountHalalas: price.amountHalalas,
            adId: input.adId
          }))
        }
      }
    });
    const intent = await this.provider.createIntent(order.id, totalHalalas);
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { providerOrderId: intent.providerId }
    });
    return { orderId: order.id, checkoutUrl: intent.checkoutUrl };
  }
}

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("orders")
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { priceCodes?: string[]; adId?: string; idempotencyKey?: string }
  ) {
    return this.payments.createOrder(user.id, body);
  }
}
