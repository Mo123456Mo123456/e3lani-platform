import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PricingModule } from '../pricing/pricing.module';
import { ModerationModule } from '../moderation/moderation.module';
import { TickerModule } from '../ticker/ticker.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AdsModule } from '../ads/ads.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [AnalyticsModule, PricingModule, ModerationModule, TickerModule, CatalogModule, AdsModule, PaymentsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
