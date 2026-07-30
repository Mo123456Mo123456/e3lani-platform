import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [RecommendationsModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
