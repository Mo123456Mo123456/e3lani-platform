'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { canAccessAdmin, hasRole } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { track } from '@planet/analytics';

const NAV: Array<{ href: string; label: string; roles?: string[] }> = [
  { href: '/', label: 'Dashboard' },
  { href: '/users', label: 'Users', roles: ['admin', 'super_admin'] },
  { href: '/planets', label: 'Planets', roles: ['admin', 'sim_manager'] },
  { href: '/contributions', label: 'Contributions', roles: ['admin', 'content_mod'] },
  { href: '/simulation', label: 'Simulation', roles: ['admin', 'sim_manager'] },
  { href: '/events', label: 'Events' },
  { href: '/moderation', label: 'Moderation', roles: ['admin', 'content_mod'] },
  { href: '/ai', label: 'AI', roles: ['admin', 'super_admin'] },
  { href: '/audit', label: 'Audit', roles: ['admin', 'super_admin'] },
  { href: '/settings', label: 'Settings', roles: ['admin', 'super_admin'] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, accessToken, clear } = useAuth();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (isLogin) return;
    if (!accessToken || !user || !canAccessAdmin(user.roles)) {
      router.replace('/login');
    }
  }, [accessToken, user, isLogin, router]);

  useEffect(() => {
    if (!isLogin) track('page_view', { page: pathname, app: 'admin' });
  }, [pathname, isLogin]);

  if (isLogin) return <>{children}</>;

  if (!accessToken || !user || !canAccessAdmin(user.roles)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-fg-muted">
        Checking session…
      </div>
    );
  }

  const visible = NAV.filter((n) => !n.roles || hasRole(user.roles, ...n.roles));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-midnight-elevated/90">
        <div className="border-b border-border px-4 py-5">
          <div className="font-display text-lg font-semibold tracking-tight text-[var(--color-accent)]">
            كوكب يولد أمامك
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">Admin Console</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {visible.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'text-fg-muted hover:bg-midnight-surface hover:text-fg'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-xs">
          <div className="truncate text-fg">{user.email}</div>
          <div className="mt-0.5 truncate text-fg-muted">{user.roles.join(', ')}</div>
          <button
            type="button"
            className="admin-btn-ghost mt-2 w-full text-xs"
            onClick={() => {
              track('logout', { app: 'admin' });
              clear();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
