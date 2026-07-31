import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@e3lani/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('اتصال قاعدة البيانات جاهز');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
