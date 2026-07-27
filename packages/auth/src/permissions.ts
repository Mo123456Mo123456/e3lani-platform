import { ROLE_PERMISSIONS, type Permission, type Role } from '@e3lani/types';

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function assertPermission(roles: readonly Role[], permission: Permission): void {
  if (!hasPermission(roles, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
