import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { RankingService } from './ranking.service';
import { FeedController } from './feed.controller';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  controllers: [FeedController],
  providers: [FeedService, RankingService],
  exports: [FeedService, RankingService],
})
export class FeedModule {}
