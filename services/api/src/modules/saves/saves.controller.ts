import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { paginationSchema } from '@e3lani/types';
import { SavesService } from './saves.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../../common/decorators';

@ApiTags('saved')
@Controller('saved')
export class SavesController {
  constructor(private readonly saves: SavesService) {}

  @Get('ads')
  async ads(
    @CurrentUser() user: AuthUser,
    @Query(zodPipe(paginationSchema)) query: { cursor?: string; limit: number },
  ) {
    return this.saves.listAds(user.id, query);
  }

  @Get('posts')
  async posts(
    @CurrentUser() user: AuthUser,
    @Query(zodPipe(paginationSchema)) query: { cursor?: string; limit: number },
  ) {
    return this.saves.listPosts(user.id, query);
  }

  @Post('ads/:id')
  async saveAd(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.saves.saveAd(user.id, id);
  }

  @Delete('ads/:id')
  async unsaveAd(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.saves.unsaveAd(user.id, id);
  }

  @Post('posts/:id')
  async savePost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.saves.savePost(user.id, id);
  }

  @Delete('posts/:id')
  async unsavePost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.saves.unsavePost(user.id, id);
  }
}
