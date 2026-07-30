import { Global, Module } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./kysely.types";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Kysely<Database> => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error("DATABASE_URL is required");
        }
        return new Kysely<Database>({
          dialect: new PostgresDialect({
            pool: new Pool({ connectionString: url, max: 12 }),
          }),
        });
      },
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
