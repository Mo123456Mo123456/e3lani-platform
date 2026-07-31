import type { Permission } from '@e3lani/config';

export interface NavItem {
  href: string;
  label: string;
  permission?: Permission;
}

/** عناصر القائمة الجانبية — تُخفى تلقائيًا حسب صلاحيات الدور. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'نظرة عامة', permission: 'analytics.read' },
  { href: '/ads', label: 'الإعلانات', permission: 'ads.read' },
  { href: '/reports', label: 'البلاغات', permission: 'reports.read' },
  { href: '/appeals', label: 'الاعتراضات', permission: 'appeals.read' },
  { href: '/posts', label: 'المنشورات', permission: 'posts.read' },
  { href: '/users', label: 'المستخدمون', permission: 'users.read' },
  { href: '/ticker', label: 'الشريط العلوي', permission: 'ticker.read' },
  { href: '/catalog', label: 'الأقسام والمدن', permission: 'catalog.read' },
  { href: '/pricing', label: 'الأسعار', permission: 'pricing.read' },
  { href: '/payments', label: 'المدفوعات', permission: 'payments.read' },
  { href: '/notifications', label: 'الإشعارات', permission: 'notifications.send' },
  { href: '/admins', label: 'فريق الإدارة', permission: 'admins.read' },
  { href: '/settings', label: 'الإعدادات', permission: 'settings.read' },
  { href: '/audit', label: 'سجل الإجراءات', permission: 'audit.read' },
];
