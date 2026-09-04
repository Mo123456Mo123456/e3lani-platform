'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { API_URL, api, tokens, type Company, type DashboardStats, type User } from '@/lib/api';
import { ROLE_AR } from './ui';

const NAV: { href: string; label: string; icon: string; minRole?: 'ADMIN' | 'SUPERVISOR' }[] = [
  { href: '/', label: 'الرئيسية', icon: '🏠' },
  { href: '/map', label: 'الخريطة', icon: '🗺' },
  { href: '/attention', label: 'تحتاج انتباه', icon: '⚠' },
  { href: '/bins', label: 'الحاويات', icon: '🗑' },
  { href: '/qr', label: 'مركز QR', icon: '🔳' },
  { href: '/vehicles', label: 'السيارات', icon: '🚛' },
  { href: '/workers', label: 'العمال والسائقون', icon: '👷' },
  { href: '/scans', label: 'الزيارات', icon: '✅' },
  { href: '/reports', label: 'التقارير', icon: '📄' },
];

const ADMIN_NAV: { href: string; label: string; icon: string }[] = [
  { href: '/devices', label: 'الأجهزة والتفعيل', icon: '📱' },
  { href: '/users', label: 'المستخدمون', icon: '👤' },
  { href: '/company', label: 'هوية الشركة', icon: '🏢' },
  { href: '/backups', label: 'النسخ الاحتياطي', icon: '💾' },
  { href: '/audit', label: 'سجل العمليات', icon: '📋' },
];

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ user: User; company: Company } | null>(null);
  const [attention, setAttention] = useState<number>(0);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!tokens.access) {
      router.replace('/login');
      return;
    }
    api<{ user: User; company: Company }>('/v1/auth/me')
      .then(setMe)
      .catch(() => {
        /* عميل الـAPI يتكفّل بالتحويل إلى تسجيل الدخول عند 401 */
      })
      .finally(() => setBooting(false));
  }, [router]);

  useEffect(() => {
    if (!me) return;
    const load = () =>
      api<DashboardStats>('/v1/dashboard')
        .then((d) => setAttention(d.needsReview + d.offlineVehicles))
        .catch(() => setAttention(0));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [me]);

  const logout = async () => {
    try {
      await api('/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken: tokens.refresh ?? undefined },
      });
    } catch {
      /* نخرج محليًا حتى لو فشل إبطال الجلسة على الخادم */
    }
    tokens.clear();
    router.replace('/login');
  };

  const isAdmin = me?.user.role === 'ADMIN';

  const item = (n: { href: string; label: string; icon: string }) => {
    const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
    return (
      <Link key={n.href} href={n.href} className={`nav-item ${active ? 'active' : ''}`}>
        <span aria-hidden>{n.icon}</span>
        <span className="label-text">{n.label}</span>
        {n.href === '/attention' && attention > 0 && <span className="badge num">{attention}</span>}
      </Link>
    );
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">VERO</div>
          <div className="tagline">كل زيارة لها إثبات</div>
        </div>

        {me && (
          <div className="sidebar-company">
            {me.company.logoUrl && (
              // الشعار يأتي من خادم الشركة نفسه
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${API_URL}${me.company.logoUrl}`} alt="" />
            )}
            <span>{me.company.name}</span>
          </div>
        )}

        <nav className="nav">
          {NAV.map(item)}
          {isAdmin && (
            <>
              <div className="nav-section">الإدارة</div>
              {ADMIN_NAV.map(item)}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {me && (
            <>
              <div style={{ color: '#fff', fontWeight: 600 }}>{me.user.fullName}</div>
              <div style={{ color: '#9dc7c2', marginBottom: 8 }}>{ROLE_AR[me.user.role]}</div>
            </>
          )}
          <button className="btn sm" style={{ width: '100%' }} onClick={logout}>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="spacer" />
          {me && (
            <span className="hint">
              التوقيت: {me.company.timezone} · النطاق الافتراضي:{' '}
              <span className="num">{me.company.defaultGpsRadiusM}</span> م
            </span>
          )}
        </header>
        <div className="content">
          {booting ? <div className="skeleton" style={{ height: 200 }} /> : children}
        </div>
      </main>
    </div>
  );
}
