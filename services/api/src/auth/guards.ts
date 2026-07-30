/**
 * Route guards: authentication + role-based access control (RBAC).
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@planet/shared-types";

const ROLE_RANK: Record<Role, number> = {
  visitor: 0,
  user: 1,
  explorer: 2,
  life_maker: 3,
  civilization_builder: 4,
  historian: 5,
  moderator: 6,
  simulation_admin: 7,
  admin: 8,
  super_admin: 9,
};

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ error: "unauthorized" });
  }
}

export function requireRole(minimum: Role) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const roles = request.user.roles ?? [];
    const rank = Math.max(0, ...roles.map((r) => ROLE_RANK[r] ?? 0));
    if (rank < ROLE_RANK[minimum]) {
      await reply.code(403).send({ error: "forbidden", required: minimum });
    }
  };
}

export function hasRole(roles: Role[], minimum: Role): boolean {
  const rank = Math.max(0, ...roles.map((r) => ROLE_RANK[r] ?? 0));
  return rank >= ROLE_RANK[minimum];
}

/** achievement-driven progression after placing contributions */
export function progressionRoles(
  current: Role[],
  placedCount: number,
  byCategory: Record<string, number>,
): Role[] {
  const roles = new Set(current.filter((r) => r !== "visitor"));
  roles.add("user");
  if (placedCount >= 3) roles.add("explorer");
  if ((byCategory.creature ?? 0) + (byCategory.plant ?? 0) >= 3) roles.add("life_maker");
  if ((byCategory.civilization ?? 0) >= 2) roles.add("civilization_builder");
  if (placedCount >= 10) roles.add("historian");
  return [...roles];
}
