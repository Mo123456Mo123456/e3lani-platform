import { Module } from '@nestjs/common';
import { AdStateService } from '../../common/ad-state.service';
import { PaymentsProviderModule } from '../payments/payments-provider.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PaymentsProviderModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, AdStateService],
})
export class WebhooksModule {}
