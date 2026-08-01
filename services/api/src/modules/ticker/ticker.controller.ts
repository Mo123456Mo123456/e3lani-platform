import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createTickerRequestSchema } from '@e3lani/types';
import { TickerService } from './ticker.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, Public, RateLimit, type AuthUser } from '../../common/decorators';

@ApiTags('ticker')
@Controller('ticker')
export class TickerController {
  constructor(private readonly ticker: TickerService) {}

  /** الشعارات الظاهرة في الشريط العلوي — بدون روابط وغير قابلة للنقر. */
  @Public()
  @Get()
  @RateLimit({ limit: 300, windowSeconds: 300 })
  async logos() {
    return this.ticker.activeLogos();
  }

  @Post('requests')
  @RateLimit({ limit: 10, windowSeconds: 3600, by: 'user' })
  async create(@CurrentUser() user: AuthUser, @Body(zodPipe(createTickerRequestSchema)) body: any) {
    return this.ticker.createRequest(user.id, body);
  }

  @Get('requests/mine')
  async mine(@CurrentUser() user: AuthUser) {
    return this.ticker.listMine(user.id);
  }

  @Delete('requests/:id')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticker.cancel(user.id, id);
  }
}
