import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export { PrismaClient };

/**
 * عميل Prisma مفرد — يتجنّب إنشاء اتصالات متعددة أثناء التطوير (hot reload).
 */
const globalForPrisma = globalThis as unknown as { __e3laniPrisma?: PrismaClient };

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.__e3laniPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__e3laniPrisma = prisma;
}

export default prisma;
