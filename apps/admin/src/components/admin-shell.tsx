'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ADMIN_ROLE_LABELS, type AdminRoleKey, type Permission } from '@e3lani/config';
import { Logo, Spinner } from '@e3lani/ui';
import { NAV_ITEMS } from '@/lib/nav';
import { adminSession, getIdentity, type AdminIdentity } from '@/lib/admin-api';

const IdentityContext = React.createContext<AdminIdentity | null>(null);

export const useIdentity = () => React.useContext(IdentityContext);

export function useCan(permission: Permission): boolean {
  const identity = useIdentity();
  return Boolean(identity?.permissions.includes(permission));
}

/** الغلاف المحمي للوحة الإدارة — يتحقق من الجلسة ويخفي ما لا يملك الدور صلاحيته. */
export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [identity, setIdentity] = React.useState<AdminIdentity | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!adminSession.token()) {
      router.replace('/login');
      return;
    }
    void getIdentity()
      .then(setIdentity)
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !identity) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  const items = NAV_ITEMS.filter(
    (item) => !item.permission || identity.permissions.includes(item.permission),
  );

  return (
    <IdentityContext.Provider value={identity}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-line bg-white p-4 md:flex">
          <Link href="/" className="mb-5 flex items-center gap-2">
            <Logo size={28} />
            <span className="text-xs font-semibold text-ink-muted">لوحة الإدارة</span>
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  pathname === item.href ? 'bg-primary text-ink' : 'text-ink-muted hover:bg-surface'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-line pt-3">
            <p className="truncate text-sm font-bold">{identity.email}</p>
            <p className="text-xs text-ink-muted">
              {ADMIN_ROLE_LABELS[identity.role as AdminRoleKey]?.ar ?? identity.role}
            </p>
            <button
              onClick={() => {
                adminSession.clear();
                router.replace('/login');
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-danger"
            >
              <LogOut size={15} /> تسجيل الخروج
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
            <h1 className="text-lg font-extrabold">{title}</h1>
            <div className="flex gap-1 overflow-x-auto md:hidden">
              {items.slice(0, 6).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-pill bg-surface px-3 py-1 text-xs font-semibold"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>
          <main className="flex-1 p-4">{children}</main>
        </div>
      </div>
    </IdentityContext.Provider>
  );
}
