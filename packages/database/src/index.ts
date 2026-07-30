import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";
import { resolve } from "node:path";

import { PrismaClient } from "../generated/client/client";

loadEnvironment({
  path: [resolve(process.cwd(), "../../.env"), resolve(process.cwd(), ".env")],
  quiet: true,
});

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalDatabase.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalDatabase.prisma = prisma;

export * from "../generated/client/client";
