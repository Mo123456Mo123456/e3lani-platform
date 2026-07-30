import bcrypt from "bcryptjs";
import { sqlite, migrate } from "./index";
import { ensureDemoWorld, persistState, DEFAULT_DEMO_SEED } from "../world-store";

migrate();
const email = process.env.SANDBOX_ADMIN_EMAIL ?? "admin@kawkab.local";
const password = process.env.SANDBOX_ADMIN_PASSWORD ?? "change-me-admin";
const now = new Date().toISOString();
const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (!existing) {
  sqlite.prepare("INSERT INTO users (id, email, password_hash, display_name, roles, refresh_token_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "sandbox-admin",
    email,
    bcrypt.hashSync(password, 10),
    "Sandbox Admin",
    JSON.stringify(["super_admin"]),
    0,
    now
  );
  console.log(`Seeded sandbox admin ${email}`);
} else {
  console.log(`Sandbox admin already exists ${email}`);
}

const world = ensureDemoWorld(DEFAULT_DEMO_SEED);
persistState(world);
console.log(
  `Seeded demo world ${world.planet.id}: ${Object.keys(world.civilizations).length} civilizations, ${Object.keys(world.cities).length} cities, ${Object.keys(world.resources).length} resources, ${Object.keys(world.species).length} species, ${Object.keys(world.plants).length} plants, ${Object.keys(world.technologies).length} technologies, ${world.events.length} events.`
);
