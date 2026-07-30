import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { requireUserId } from '../../common/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiBearerAuth()
  @Get('mine')
  async mine(@Headers('authorization') authorization?: string) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.posts.listMine(user.sub);
  }

  @Get('by-owner/:ownerId')
  listByOwner(@Param('ownerId') ownerId: string) {
    return this.posts.listByOwner(ownerId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.posts.getById(id);
  }

  @ApiBearerAuth()
  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.posts.create(user.sub, body);
  }

  @ApiBearerAuth()
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.posts.update(id, user.sub, body);
  }

  @ApiBearerAuth()
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.posts.remove(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/save')
  async save(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.posts.save(id, user.sub);
  }

  @ApiBearerAuth()
  @Delete(':id/save')
  async unsave(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const user = await requireUserId(this.jwt, authorization, this.prisma);
    return this.posts.unsave(id, user.sub);
  }

  @Post(':id/share')
  async share(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    let userId: string | undefined;
    if (authorization?.startsWith('Bearer ')) {
      try {
        const user = await requireUserId(this.jwt, authorization, this.prisma);
        userId = user.sub;
      } catch {
        userId = undefined;
      }
    }
    return this.posts.share(id, userId);
  }
}
