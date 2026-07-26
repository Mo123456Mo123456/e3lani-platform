import { Module } from '@nestjs/common';
import { AdStateService } from '../../common/ad-state.service';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  controllers: [AdsController],
  providers: [AdsService, AdStateService],
  exports: [AdsService, AdStateService],
})
export class AdsModule {}
