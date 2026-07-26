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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    GeoModule,
    AdsModule,
    FeedModule,
    OrdersModule,
  ],
})
export class AppModule {}
