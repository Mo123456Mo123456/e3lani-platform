import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { searchQuerySchema } from '@e3lani/types';
import { SearchService, type SearchQuery } from './search.service';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, OptionalAuth, Public, RateLimit, type AuthUser } from '../../common/decorators';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @OptionalAuth()
  @Get()
  @RateLimit({ limit: 120, windowSeconds: 300 })
  async find(@Query(zodPipe(searchQuerySchema)) query: SearchQuery, @CurrentUser() user?: AuthUser) {
    return this.search.search(query, user?.id ?? null);
  }

  @Public()
  @Get('suggestions')
  async suggestions(@Query('q') term: string) {
    return this.search.suggestions(term ?? '');
  }
}
