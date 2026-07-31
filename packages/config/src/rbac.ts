/** الأدوار والصلاحيات داخل لوحة الإدارة — RBAC حقيقي مطبّق على مستوى الخادم. */
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADS_MODERATOR: 'ADS_MODERATOR',
  SUPPORT: 'SUPPORT',
  CAMPAIGN_MANAGER: 'CAMPAIGN_MANAGER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
} as const;

export type AdminRoleKey = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

export const ADMIN_ROLE_LABELS: Record<AdminRoleKey, { ar: string; en: string }> = {
  SUPER_ADMIN: { ar: 'مدير عام', en: 'Super admin' },
  ADS_MODERATOR: { ar: 'مشرف إعلانات', en: 'Ads moderator' },
  SUPPORT: { ar: 'الدعم', en: 'Support' },
  CAMPAIGN_MANAGER: { ar: 'مدير حملات', en: 'Campaign manager' },
  FINANCE_MANAGER: { ar: 'مدير مالي', en: 'Finance manager' },
  CONTENT_MANAGER: { ar: 'مدير محتوى', en: 'Content manager' },
};

export const PERMISSIONS = [
  'users.read', 'users.write', 'users.suspend',
  'admins.read', 'admins.write',
  'business.read', 'business.verify',
  'ads.read', 'ads.moderate', 'ads.delete',
  'posts.read', 'posts.moderate',
  'reports.read', 'reports.resolve',
  'appeals.read', 'appeals.resolve',
  'ticker.read', 'ticker.review',
  'catalog.read', 'catalog.write',
  'pricing.read', 'pricing.write',
  'payments.read', 'payments.refund',
  'notifications.read', 'notifications.send',
  'analytics.read',
  'audit.read',
  'settings.read', 'settings.write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRoleKey, Permission[] | ['*']> = {
  SUPER_ADMIN: ['*'],
  ADS_MODERATOR: [
    'ads.read', 'ads.moderate', 'ads.delete',
    'posts.read', 'posts.moderate',
    'reports.read', 'reports.resolve',
    'appeals.read', 'appeals.resolve',
    'users.read', 'notifications.send', 'analytics.read', 'audit.read',
  ],
  SUPPORT: [
    'users.read', 'ads.read', 'posts.read', 'reports.read', 'appeals.read',
    'payments.read', 'notifications.read', 'notifications.send',
  ],
  CAMPAIGN_MANAGER: [
    'ads.read', 'ticker.read', 'ticker.review', 'analytics.read',
    'business.read', 'notifications.send', 'catalog.read',
  ],
  FINANCE_MANAGER: [
    'payments.read', 'payments.refund', 'pricing.read', 'pricing.write',
    'analytics.read', 'users.read', 'ads.read', 'audit.read',
  ],
  CONTENT_MANAGER: [
    'catalog.read', 'catalog.write', 'posts.read', 'posts.moderate',
    'ads.read', 'business.read', 'business.verify', 'notifications.send',
  ],
};

export function roleHasPermission(role: AdminRoleKey, permission: Permission): boolean {
  const granted = ROLE_PERMISSIONS[role];
  if (!granted) return false;
  if (granted[0] === '*') return true;
  return (granted as Permission[]).includes(permission);
}

export function permissionsForRole(role: AdminRoleKey): Permission[] {
  const granted = ROLE_PERMISSIONS[role];
  if (granted && granted[0] === '*') return [...PERMISSIONS];
  return [...((granted as Permission[]) ?? [])];
}
