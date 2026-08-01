import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { BillingService } from './billing.service';
import { PaymentsController } from './payments.controller';
import { paymentProviderFactory } from './providers/payment.factory';
import { PricingModule } from '../pricing/pricing.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { AdsModule } from '../ads/ads.module';

@Module({
  imports: [PricingModule, PromotionsModule, AdsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, BillingService, paymentProviderFactory],
  exports: [PaymentsService, BillingService],
})
export class PaymentsModule {}
