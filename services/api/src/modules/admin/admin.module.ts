import { Module } from '@nestjs/common';
import { AdStateService } from '../../common/ad-state.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdStateService],
})
export class AdminModule {}
