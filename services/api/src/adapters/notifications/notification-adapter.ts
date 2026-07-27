import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type InAppNotificationInput = {
  userId: string;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  payload?: Prisma.InputJsonValue;
};

export type PushNotificationInput = {
  userId: string;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue;
  tokens?: string[];
};

export type EmailNotificationInput = {
  to: string;
  subject: string;
  body: string;
};

export type SmsNotificationInput = {
  to: string;
  body: string;
};

export type DeliveryResult = {
  provider: string;
  sandbox: boolean;
  delivered: boolean;
  messageId?: string;
};

export interface NotificationAdapter {
  sendInApp(input: InAppNotificationInput): Promise<Notification>;
  sendPush(input: PushNotificationInput): Promise<DeliveryResult>;
  sendEmail(input: EmailNotificationInput): Promise<DeliveryResult>;
  sendSms(input: SmsNotificationInput): Promise<DeliveryResult>;
}

export class NotificationProviderNotConfiguredError extends Error {
  constructor(channel: string, missing: string[], provider?: string) {
    super(
      `NOTIFICATION_PROVIDER_NOT_CONFIGURED:${channel}:${provider ?? 'unset'}:${
        missing.length > 0 ? `missing ${missing.join(',')}` : 'placeholder has no live implementation'
      }`,
    );
    this.name = 'NotificationProviderNotConfiguredError';
  }
}

@Injectable()
export class SandboxNotificationAdapter implements NotificationAdapter {
  protected readonly log = new Logger(SandboxNotificationAdapter.name);

  constructor(protected readonly prisma: PrismaService) {}

  sendInApp(input: InAppNotificationInput) {
    this.log.log(`sandbox in-app notification user=${input.userId} type=${input.type}`);
    return this.prisma.notification.create({ data: input });
  }

  async sendPush(input: PushNotificationInput): Promise<DeliveryResult> {
    this.log.log(
      `sandbox push notification user=${input.userId} tokens=${input.tokens?.length ?? 0}`,
    );
    return { provider: 'sandbox', sandbox: true, delivered: true };
  }

  async sendEmail(input: EmailNotificationInput): Promise<DeliveryResult> {
    this.log.log(`sandbox email notification to=${input.to} subject=${input.subject}`);
    return { provider: 'sandbox', sandbox: true, delivered: true };
  }

  async sendSms(input: SmsNotificationInput): Promise<DeliveryResult> {
    this.log.log(`sandbox sms notification to=${input.to}`);
    return { provider: 'sandbox', sandbox: true, delivered: true };
  }
}

@Injectable()
export class ProductionNotificationPlaceholderAdapter
  extends SandboxNotificationAdapter
  implements NotificationAdapter
{
  private readonly env = process.env;

  async sendPush(_input: PushNotificationInput): Promise<DeliveryResult> {
    return this.failClosed('push', this.env.PUSH_PROVIDER, ['PUSH_PROVIDER', 'FCM_SERVER_KEY']);
  }

  async sendEmail(_input: EmailNotificationInput): Promise<DeliveryResult> {
    const provider = this.env.EMAIL_PROVIDER;
    const smtpMissing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].filter(
      (key) => !this.env[key]?.trim(),
    );
    if (!provider?.trim()) {
      throw new NotificationProviderNotConfiguredError('email', ['EMAIL_PROVIDER'], provider);
    }
    if (provider === 'smtp' && smtpMissing.length > 0) {
      throw new NotificationProviderNotConfiguredError('email', smtpMissing, provider);
    }
    throw new NotificationProviderNotConfiguredError('email', [], provider);
  }

  async sendSms(_input: SmsNotificationInput): Promise<DeliveryResult> {
    return this.failClosed('sms', this.env.SMS_PROVIDER, [
      'SMS_PROVIDER',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_FROM_NUMBER',
    ]);
  }

  private failClosed(channel: string, provider: string | undefined, keys: string[]): never {
    const missing = keys.filter((key) => !this.env[key]?.trim());
    if (missing.length > 0) {
      throw new NotificationProviderNotConfiguredError(channel, missing, provider);
    }
    throw new NotificationProviderNotConfiguredError(channel, [], provider);
  }
}

export function notificationMode(env: NodeJS.ProcessEnv = process.env): 'sandbox' | 'production' {
  const mode = (env.NOTIFICATIONS_MODE ?? env.APP_ENV ?? env.NODE_ENV ?? 'sandbox').toLowerCase();
  return mode === 'production' ? 'production' : 'sandbox';
}
