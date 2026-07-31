import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { FeedModule } from '../feed/feed.module';

@Module({
  imports: [CatalogModule, FeedModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
