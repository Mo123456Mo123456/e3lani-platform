import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { resolve } from 'node:path';
import { validateEnv } from './config/env';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { MediaModule } from './modules/media/media.module';
import { AdsModule } from './modules/ads/ads.module';
import { FeedModule } from './modules/feed/feed.module';
import { SearchModule } from './modules/search/search.module';
import { SavesModule } from './modules/saves/saves.module';
import { PostsModule } from './modules/posts/posts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TickerModule } from './modules/ticker/ticker.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../../.env'),
      ],
    }),
    CommonModule,
    NotificationsModule,
    PrivacyModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    MediaModule,
    AdsModule,
    PostsModule,
    AccountsModule,
    FeedModule,
    SearchModule,
    SavesModule,
    ModerationModule,
    AnalyticsModule,
    PricingModule,
    PromotionsModule,
    PaymentsModule,
    TickerModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // حارس واحد عام فقط — تسجيله مرة أخرى على المتحكمات يضاعف العدّ ويُنصّف الحدود
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
