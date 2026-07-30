/**
 * Boot-time provisioning: sandbox accounts (documented in README) and the
 * default planet. Idempotent — safe to run on every start.
 */
import { randomUUID } from "node:crypto";
import type { PlanetSummary } from "@planet/shared-types";
import { hashPassword } from "../auth/passwords";
import type { Repository, StoredUser } from "../store/repository";
import type { AppContext } from "../context";

export const SANDBOX_ACCOUNTS = [
  {
    email: "admin@planet.local",
    password: "planet-admin-2026",
    displayName: "مدير النظام",
    roles: ["super_admin", "admin", "simulation_admin", "moderator"] as const,
  },
  {
    email: "explorer@planet.local",
    password: "planet-explorer-2026",
    displayName: "مستكشف الكوكب",
    roles: ["user", "explorer"] as const,
  },
];

export async function seedSandboxAccounts(repository: Repository): Promise<void> {
  for (const account of SANDBOX_ACCOUNTS) {
    const existing = await repository.findUserByEmail(account.email);
    if (existing) continue;
    const user: StoredUser = {
      id: randomUUID(),
      email: account.email,
      displayName: account.displayName,
      roles: [...account.roles],
      provider: "email",
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(account.password),
    };
    await repository.createUser(user);
  }
}

export async function ensureDefaultPlanet(ctx: AppContext): Promise<PlanetSummary> {
  const planets = await ctx.repository.listPlanets();
  if (planets.length > 0) return planets[0]!;
  const planet = await ctx.worlds.createPlanet(ctx.env.DEFAULT_PLANET_SEED, "كوكب التكوين الأول");
  // a young but living world: fast-forward 60 ticks (300 years) so the first
  // visitor already sees history, wars and migrations in the timeline
  await ctx.worlds.advance(planet.id, 60);
  const updated = (await ctx.repository.listPlanets()).find((p) => p.id === planet.id)!;
  console.log(`[api] default planet created: ${planet.id} (seed ${planet.seed}, year ${updated.currentYear})`);
  return updated;
}
