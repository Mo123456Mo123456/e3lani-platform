'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'لوحة المتابعة' },
  { href: '/login', label: 'دخول المشرف' },
  { href: '/users', label: 'المستخدمون' },
  { href: '/verification', label: 'توثيق المعلنين' },
  { href: '/ads/review', label: 'مراجعة الإعلانات' },
  { href: '/reports', label: 'البلاغات' },
  { href: '/appeals', label: 'الاعتراضات' },
  { href: '/categories', label: 'التصنيفات' },
  { href: '/pricing', label: 'التسعير' },
  { href: '/orders', label: 'الطلبات' },
  { href: '/payments', label: 'المدفوعات' },
  { href: '/refunds', label: 'الاستردادات' },
  { href: '/campaigns', label: 'الحملات' },
  { href: '/templates', label: 'قوالب الإشعارات' },
  { href: '/flags', label: 'Feature Flags' },
  { href: '/recommendations', label: 'التوصيات الذكية' },
  { href: '/health', label: 'صحة النظام' },
  { href: '/audit', label: 'سجل التدقيق' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <aside className="side">
        <h1>إعلاني Admin</h1>
        <p className="muted" style={{ color: 'rgba(255,255,255,.65)' }}>
          إدارة التشغيل والمراجعة
        </p>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? 'active' : ''}>
            {link.label}
          </Link>
        ))}
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
