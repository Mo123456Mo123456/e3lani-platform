import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ensureSeedData } from './ensure-seed';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (process.env.DATABASE_URL) {
      await this.$connect();
      // Staging/bootstrap: fill categories/geo when DB is empty (idempotent).
      await ensureSeedData(this);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
