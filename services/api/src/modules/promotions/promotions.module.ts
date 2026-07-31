import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
