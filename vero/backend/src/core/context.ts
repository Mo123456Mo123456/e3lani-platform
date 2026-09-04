export type Role = 'ADMIN' | 'SUPERVISOR' | 'VIEWER';

export interface UserActor {
  kind: 'user';
  id: string;
  companyId: string;
  role: Role;
  fullName: string;
  username: string;
}

export interface DeviceActor {
  kind: 'device';
  id: string;
  companyId: string;
  workerId: string;
  vehicleId: string;
  deviceUid: string;
}

export type Actor = UserActor | DeviceActor;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface Ctx {
  companyId: string;
  actor: Actor | null;
  meta: RequestMeta;
}

export const ROLE_RANK: Record<Role, number> = { VIEWER: 1, SUPERVISOR: 2, ADMIN: 3 };

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function actorLabel(actor: Actor | null): string {
  if (!actor) return 'system';
  return actor.kind === 'user' ? `user:${actor.username}` : `device:${actor.deviceUid}`;
}
