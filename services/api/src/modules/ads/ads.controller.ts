import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { adStatusFilterSchema, createAdSchema, paginationSchema, updateAdSchema } from '@e3lani/types';
import { AdsService } from './ads.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CurrentUser, OptionalAuth, Public, RateLimit, type AuthUser,
} from '../../common/decorators';

const myAdsQuerySchema = paginationSchema.extend({
  status: adStatusFilterSchema.optional(),
});

@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Post()
  @RateLimit({ limit: 20, windowSeconds: 3600, by: 'user' })
  async create(@CurrentUser() user: AuthUser, @Body(zodPipe(createAdSchema)) body: any) {
    return this.ads.create(user.id, body);
  }

  @Get(':id/revisions')
  async revisions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ads.revisions(id, { userId: user.id });
  }

  @Get('mine')
  async mine(
    @CurrentUser() user: AuthUser,
    @Query(zodPipe(myAdsQuerySchema)) query: { status?: string; cursor?: string; limit: number },
  ) {
    return this.ads.listMine(user.id, query);
  }

  @OptionalAuth()
  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.ads.getPublic(id, user?.id ?? null);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodPipe(updateAdSchema)) body: any,
  ) {
    return this.ads.update(user.id, id, body);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RateLimit({ limit: 30, windowSeconds: 3600, by: 'user' })
  async publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ads.publish(user.id, id);
  }

  @Post(':id/pause')
  @HttpCode(200)
  async pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ads.pause(user.id, id);
  }

  @Post(':id/resume')
  @HttpCode(200)
  async resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ads.resume(user.id, id);
  }

  @Public()
  @Post(':id/share')
  @HttpCode(200)
  @RateLimit({ limit: 60, windowSeconds: 600 })
  async share(@Param('id') id: string) {
    await this.ads.registerShare(id);
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.ads.remove(user.id, id);
    return { deleted: true };
  }
}
