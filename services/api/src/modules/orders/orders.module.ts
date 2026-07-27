import { Module } from '@nestjs/common';
import { AdStateService } from '../../common/ad-state.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, AdStateService],
})
export class OrdersModule {}
