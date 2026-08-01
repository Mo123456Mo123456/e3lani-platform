import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createAppealSchema, createReportSchema } from '@e3lani/types';
import { ReportsService } from './reports.service';
import { AppealsService } from './appeals.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, Public, RateLimit, type AuthUser } from '../../common/decorators';

@ApiTags('moderation')
@Controller()
export class ModerationController {
  constructor(
    private readonly reports: ReportsService,
    private readonly appeals: AppealsService,
  ) {}

  @Public()
  @Get('reports/reasons')
  reasons() {
    return this.reports.reasons();
  }

  @Post('reports')
  @RateLimit({ limit: 20, windowSeconds: 3600, by: 'user' })
  async report(@CurrentUser() user: AuthUser, @Body(zodPipe(createReportSchema)) body: any) {
    return this.reports.create(user.id, body);
  }

  @Post('appeals')
  @RateLimit({ limit: 10, windowSeconds: 3600, by: 'user' })
  async appeal(@CurrentUser() user: AuthUser, @Body(zodPipe(createAppealSchema)) body: any) {
    return this.appeals.create(user.id, body);
  }

  @Get('appeals/mine')
  async myAppeals(@CurrentUser() user: AuthUser) {
    return this.appeals.listMine(user.id);
  }
}
