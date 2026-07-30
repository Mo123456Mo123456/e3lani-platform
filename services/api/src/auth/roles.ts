export const ROLE_HIERARCHY = [
  'visitor',
  'user',
  'explorer',
  'life_maker',
  'civ_creator',
  'historian',
  'content_mod',
  'sim_manager',
  'admin',
  'super_admin',
] as const;

export type RoleName = (typeof ROLE_HIERARCHY)[number];

export const ROLE_LEVEL: Record<RoleName, number> = {
  visitor: 0,
  user: 10,
  explorer: 20,
  life_maker: 30,
  civ_creator: 40,
  historian: 50,
  content_mod: 60,
  sim_manager: 70,
  admin: 80,
  super_admin: 100,
};

export function maxRoleLevel(roles: string[]): number {
  return roles.reduce((max, r) => Math.max(max, ROLE_LEVEL[r as RoleName] ?? 0), 0);
}

export function hasMinRole(userRoles: string[], required: RoleName): boolean {
  return maxRoleLevel(userRoles) >= ROLE_LEVEL[required];
}

export function hasAnyRole(userRoles: string[], required: RoleName[]): boolean {
  return required.some((r) => userRoles.includes(r)) || hasMinRole(userRoles, required[0]!);
}
