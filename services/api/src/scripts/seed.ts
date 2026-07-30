import "dotenv/config";
import { PostgresWorldRepository } from "../adapters/postgres-repository.js";
import { hashPassword } from "../domain/security.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const repository = new PostgresWorldRepository(databaseUrl);
try {
  const summary = await repository.seedDemoWorld();
  if (process.env.SANDBOX_MODE === "true") {
    const email = process.env.SANDBOX_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SANDBOX_SUPER_ADMIN_PASSWORD;
    if (email && password) {
      const existing = await repository.findUserByEmail(email);
      if (!existing) {
        await repository.createAccount({
          email,
          displayName: "Kawkab Sandbox Super Admin",
          passwordHash: await hashPassword(password),
          role: "super_admin",
        });
      }
    }
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await repository.close();
}
