import { Module } from '@nestjs/common';
import { TickerService } from './ticker.service';
import { TickerController } from './ticker.controller';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [TickerController],
  providers: [TickerService],
  exports: [TickerService],
})
export class TickerModule {}
