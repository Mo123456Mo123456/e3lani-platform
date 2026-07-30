/**
 * @e3lani/database
 *
 * Canonical Prisma schema: `services/api/prisma/schema.prisma`
 * Generate client: `pnpm --filter @e3lani/api prisma:generate`
 *
 * This package documents the shared database boundary for the monorepo.
 * Runtime NestJS services import PrismaService from `@e3lani/api` internals;
 * apps must never talk to the database directly.
 */

export type DatabaseBoundary = {
  provider: 'postgresql';
  orm: 'prisma';
  schemaPath: 'services/api/prisma/schema.prisma';
};

export const DATABASE_BOUNDARY: DatabaseBoundary = {
  provider: 'postgresql',
  orm: 'prisma',
  schemaPath: 'services/api/prisma/schema.prisma',
};
