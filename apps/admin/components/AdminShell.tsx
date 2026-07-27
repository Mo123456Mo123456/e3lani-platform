'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'لوحة المتابعة' },
  { href: '/login', label: 'دخول المشرف' },
  { href: '/ads/review', label: 'مراجعة الإعلانات' },
  { href: '/orders', label: 'الطلبات' },
  { href: '/payments', label: 'المدفوعات' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <aside className="side">
        <h1>إعلاني Admin</h1>
        <p className="muted" style={{ color: 'rgba(255,255,255,.65)' }}>
          المراجعة قبل الدفع
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
