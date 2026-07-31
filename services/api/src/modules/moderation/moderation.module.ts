import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AppealsService } from './appeals.service';
import { ModerationController } from './moderation.controller';

@Module({
  controllers: [ModerationController],
  providers: [ReportsService, AppealsService],
  exports: [ReportsService, AppealsService],
})
export class ModerationModule {}
