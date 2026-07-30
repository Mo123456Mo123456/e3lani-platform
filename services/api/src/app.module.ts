import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { GeoModule } from './modules/geo/geo.module';
import { AdsModule } from './modules/ads/ads.module';
import { FeedModule } from './modules/feed/feed.module';
import { OrdersModule } from './modules/orders/orders.module';
import { MediaModule } from './modules/media/media.module';
import { AdminModule } from './modules/admin/admin.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { PaymentsProviderModule } from './modules/payments/payments-provider.module';
import { SavedModule } from './modules/saved/saved.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AppealsModule } from './modules/appeals/appeals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { PostsModule } from './modules/posts/posts.module';
import { TickerModule } from './modules/ticker/ticker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    PaymentsProviderModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    GeoModule,
    AdsModule,
    FeedModule,
    OrdersModule,
    MediaModule,
    AdminModule,
    WebhooksModule,
    SavedModule,
    BrandsModule,
    ReportsModule,
    AppealsModule,
    NotificationsModule,
    AnalyticsModule,
    CampaignsModule,
    PostsModule,
    TickerModule,
  ],
})
export class AppModule {}
