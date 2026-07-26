export const ROLES = [
  'VISITOR',
  'USER',
  'ADVERTISER',
  'BRAND',
  'ENTERPRISE',
  'AD_MODERATOR',
  'SUPPORT',
  'CAMPAIGN_MANAGER',
  'FINANCE',
  'SUPER_ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'ads:create',
  'ads:review',
  'ads:approve',
  'ads:reject',
  'ads:remove',
  'users:suspend',
  'payments:view',
  'payments:refund',
  'pricing:manage',
  'campaigns:manage',
  'audit:view',
  'providers:manage',
  'categories:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  VISITOR: [],
  USER: ['ads:create'],
  ADVERTISER: ['ads:create'],
  BRAND: ['ads:create'],
  ENTERPRISE: ['ads:create', 'campaigns:manage'],
  AD_MODERATOR: ['ads:review', 'ads:approve', 'ads:reject', 'ads:remove'],
  SUPPORT: ['ads:review', 'users:suspend', 'audit:view'],
  CAMPAIGN_MANAGER: ['campaigns:manage', 'ads:review', 'audit:view'],
  FINANCE: ['payments:view', 'payments:refund', 'pricing:manage', 'audit:view'],
  SUPER_ADMIN: [...PERMISSIONS],
};
