import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createPostSchema, updatePostSchema } from '@e3lani/types';
import { PostsService } from './posts.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CurrentUser, OptionalAuth, Public, RateLimit, type AuthUser,
} from '../../common/decorators';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @RateLimit({ limit: 30, windowSeconds: 3600, by: 'user' })
  async create(@CurrentUser() user: AuthUser, @Body(zodPipe(createPostSchema)) body: any) {
    return this.posts.create(user.id, body);
  }

  @OptionalAuth()
  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.posts.getPublic(id, user?.id ?? null);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodPipe(updatePostSchema)) body: any,
  ) {
    return this.posts.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.posts.remove(user.id, id);
    return { deleted: true };
  }

  @Public()
  @Post(':id/share')
  @HttpCode(200)
  @RateLimit({ limit: 60, windowSeconds: 600 })
  async share(@Param('id') id: string) {
    await this.posts.registerShare(id);
    return { ok: true };
  }
}
