import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpProvider } from './otp-provider.interface';
import { ConsoleOtpProvider } from './console.provider';
import { TaqnyatOtpProvider } from './taqnyat.provider';
import { UnifonicOtpProvider } from './unifonic.provider';
import { MsegatOtpProvider } from './msegat.provider';

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');

/** يختار مزوّد الرسائل حسب متغيّر البيئة OTP_PROVIDER. */
export const otpProviderFactory: Provider = {
  provide: OTP_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): OtpProvider => {
    const logger = new Logger('OtpProviderFactory');
    const name = config.get<string>('OTP_PROVIDER') ?? 'console';

    switch (name) {
      case 'taqnyat':
        return new TaqnyatOtpProvider(
          config.getOrThrow<string>('TAQNYAT_API_KEY'),
          config.get<string>('TAQNYAT_SENDER') ?? 'E3lani',
        );
      case 'unifonic':
        return new UnifonicOtpProvider(
          config.getOrThrow<string>('UNIFONIC_APP_SID'),
          config.get<string>('UNIFONIC_SENDER_ID') ?? 'E3lani',
        );
      case 'msegat':
        return new MsegatOtpProvider(
          config.getOrThrow<string>('MSEGAT_USERNAME'),
          config.getOrThrow<string>('MSEGAT_API_KEY'),
          config.get<string>('MSEGAT_SENDER') ?? 'E3lani',
        );
      default:
        logger.warn('يعمل مزوّد OTP في وضع التطوير (console).');
        return new ConsoleOtpProvider();
    }
  },
};
