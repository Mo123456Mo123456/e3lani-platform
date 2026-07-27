import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
  ],
})
export class AppModule {}
