import { Module } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { MediaModule } from '../media/media.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [MediaModule, PricingModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
