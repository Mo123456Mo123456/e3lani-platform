import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ProductionPaymentProviderStub,
  SandboxPaymentProvider,
  type PaymentProvider,
} from '@e3lani/payments';

@Injectable()
export class PaymentsProviderService implements OnModuleInit {
  private providers = new Map<string, PaymentProvider>();
  private sandbox: SandboxPaymentProvider | null = null;

  onModuleInit() {
    const mode = process.env.PAYMENT_MODE ?? 'sandbox';
    if (mode === 'sandbox') {
      const secret = process.env.SANDBOX_PAYMENT_WEBHOOK_SECRET ?? 'e3lani-sandbox-webhook-secret';
      this.sandbox = new SandboxPaymentProvider(
        secret,
        process.env.API_PUBLIC_URL ?? 'http://localhost:3001',
      );
      this.providers.set('sandbox', this.sandbox);
    } else {
      const providerName = process.env.PAYMENT_PROVIDER ?? 'production';
      this.providers.set(
        providerName,
        new ProductionPaymentProviderStub({ providerName, mode }),
      );
    }
  }

  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    const mode = process.env.PAYMENT_MODE ?? 'sandbox';
    if (!provider && mode !== 'sandbox') {
      const stub = new ProductionPaymentProviderStub({ providerName: name, mode });
      this.providers.set(name, stub);
      return stub;
    }
    if (!provider) {
      throw new Error(`Payment provider not configured: ${name}`);
    }
    return provider;
  }

  getSandbox(): SandboxPaymentProvider {
    if (!this.sandbox) {
      throw new Error('Sandbox payment provider is not active');
    }
    return this.sandbox;
  }

  list() {
    return [...this.providers.keys()];
  }
}
