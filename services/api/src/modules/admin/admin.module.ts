import { Module } from '@nestjs/common';
import { AdStateService } from '../../common/ad-state.service';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CampaignsModule],
  controllers: [AdminController],
  providers: [AdminService, AdStateService],
})
export class AdminModule {}
