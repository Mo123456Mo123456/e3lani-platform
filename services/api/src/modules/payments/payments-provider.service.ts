import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  MoyasarPaymentProvider,
  ProductionPaymentProviderStub,
  SandboxPaymentProvider,
  type PaymentProvider,
} from '@e3lani/payments';
import { apiPublicBaseUrl } from '@e3lani/storage';

@Injectable()
export class PaymentsProviderService implements OnModuleInit {
  private providers = new Map<string, PaymentProvider>();
  private sandbox: SandboxPaymentProvider | null = null;

  onModuleInit() {
    const mode = process.env.PAYMENT_MODE ?? 'sandbox';
    if (mode === 'sandbox') {
      const secret = process.env.SANDBOX_PAYMENT_WEBHOOK_SECRET ?? 'e3lani-sandbox-webhook-secret';
      this.sandbox = new SandboxPaymentProvider(secret, apiPublicBaseUrl());
      this.providers.set('sandbox', this.sandbox);
    } else {
      const providerName = process.env.PAYMENT_PROVIDER ?? 'moyasar';
      this.providers.set(providerName, this.createProductionProvider(providerName, mode));
    }
  }

  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    const mode = process.env.PAYMENT_MODE ?? 'sandbox';
    if (!provider && mode !== 'sandbox') {
      const productionProvider = this.createProductionProvider(name, mode);
      this.providers.set(name, productionProvider);
      return productionProvider;
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

  private createProductionProvider(providerName: string, mode: string): PaymentProvider {
    if (providerName === 'moyasar') {
      return new MoyasarPaymentProvider();
    }
    return new ProductionPaymentProviderStub({ providerName, mode });
  }
}
