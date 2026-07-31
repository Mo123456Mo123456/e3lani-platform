import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { paginationSchema } from '@e3lani/types';
import { AccountsService } from './accounts.service';
import { PostsService } from '../posts/posts.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, OptionalAuth, Public, type AuthUser } from '../../common/decorators';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly posts: PostsService,
  ) {}

  @Public()
  @Get(':id')
  async profile(@Param('id') id: string) {
    return this.accounts.profile(id);
  }

  @OptionalAuth()
  @Get(':id/ads')
  async ads(
    @Param('id') id: string,
    @Query(zodPipe(paginationSchema)) query: { cursor?: string; limit: number },
    @CurrentUser() user?: AuthUser,
  ) {
    return this.accounts.ads(id, query, user?.id ?? null);
  }

  /** المنشورات المجانية تُقرأ من هنا فقط — لا وجود لها في الموجز أو البحث. */
  @OptionalAuth()
  @Get(':id/posts')
  async posts_(
    @Param('id') id: string,
    @Query(zodPipe(paginationSchema)) query: { cursor?: string; limit: number },
    @CurrentUser() user?: AuthUser,
  ) {
    return this.posts.listByAccount(id, query, user?.id ?? null);
  }
}
