import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentProvider } from './payment-provider.interface';
import { SandboxPaymentProvider } from './sandbox.provider';
import { MoyasarPaymentProvider } from './moyasar.provider';
import { TapPaymentProvider } from './tap.provider';
import { HyperpayPaymentProvider } from './hyperpay.provider';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export const paymentProviderFactory: Provider = {
  provide: PAYMENT_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): PaymentProvider => {
    const logger = new Logger('PaymentProviderFactory');
    const name = config.get<string>('PAYMENT_PROVIDER') ?? 'sandbox';

    switch (name) {
      case 'moyasar':
        return new MoyasarPaymentProvider(
          config.getOrThrow<string>('MOYASAR_SECRET_KEY'),
          config.get<string>('MOYASAR_WEBHOOK_SECRET'),
        );
      case 'tap':
        return new TapPaymentProvider(config.getOrThrow<string>('TAP_SECRET_KEY'));
      case 'hyperpay':
        return new HyperpayPaymentProvider(
          config.getOrThrow<string>('HYPERPAY_ENTITY_ID'),
          config.getOrThrow<string>('HYPERPAY_ACCESS_TOKEN'),
        );
      default: {
        const port = config.get<number>('API_PORT') ?? 4000;
        const prefix = config.get<string>('API_PREFIX') ?? 'api';
        logger.warn('مزوّد الدفع يعمل في الوضع التجريبي (sandbox) — للتطوير فقط.');
        return new SandboxPaymentProvider(`http://localhost:${port}/${prefix}`);
      }
    }
  },
};
