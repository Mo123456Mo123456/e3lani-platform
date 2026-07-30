import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { AppModule } from "../src/app.module.js";
import { DatabaseService } from "../src/database.service.js";

const scrypt = promisify(scryptCallback);
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ["error", "warn", "log"],
});

try {
  const database = app.get(DatabaseService);
  const email = "superadmin@planet.sandbox";
  const password = "PlanetSandbox!2026";
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const passwordHash = `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
  await database.query(
    `WITH admin AS (
       INSERT INTO users(email,password_hash,role,preferred_locale)
       VALUES($1,$2,'super_admin','ar')
       ON CONFLICT(email) DO UPDATE SET role='super_admin'
       RETURNING id
     )
     INSERT INTO profiles(user_id,display_name)
     SELECT id,'مدير العالم التجريبي' FROM admin
     ON CONFLICT(user_id) DO NOTHING`,
    [email, passwordHash],
  );
  process.stdout.write("Sandbox world and account seeded. Credentials are documented in README only.\n");
} finally {
  await app.close();
}
