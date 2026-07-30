import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import * as schema from "./schema.js";
import { hashPassword } from "../auth/auth.js";

async function seed() {
  const adminEmail = process.env.SANDBOX_ADMIN_EMAIL ?? "admin@planet-born.local";
  const adminPass = process.env.SANDBOX_ADMIN_PASSWORD ?? "PlanetAdmin!2026";
  const userEmail = process.env.SANDBOX_USER_EMAIL ?? "explorer@planet-born.local";
  const userPass = process.env.SANDBOX_USER_PASSWORD ?? "Explorer!2026";

  const ensureUser = async (
    email: string,
    password: string,
    displayName: string,
    role: string,
  ) => {
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing) {
      console.log(`User exists: ${email} (${existing.role})`);
      return existing;
    }
    const passwordHash = await hashPassword(password);
    const [u] = await db
      .insert(schema.users)
      .values({
        email,
        passwordHash,
        displayName,
        role,
        locale: "ar",
        level: role === "super_admin" ? 99 : 7,
        xp: role === "super_admin" ? 9999 : 1280,
      })
      .returning();
    console.log(`Created ${role}: ${email}`);
    return u!;
  };

  await ensureUser(adminEmail, adminPass, "مدير النظام", "super_admin");
  await ensureUser(userEmail, userPass, "مستكشف كوكب", "explorer");

  console.log("✓ Seed complete (users). Planet bootstrap runs on API startup.");
  console.log(`  Admin: ${adminEmail} / ${adminPass}`);
  console.log(`  Explorer: ${userEmail} / ${userPass}`);
  await pool.end();
}

seed().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
