import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { Logo } from '@e3lani/ui';

const TABS = [
  { key: 'for-you', label: 'لك' },
  { key: 'nearby', label: 'قريب منك' },
  { key: 'latest', label: 'الأحدث' },
] as const;

export function SiteHeader({ activeTab }: { activeTab: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" aria-label="إعلاني">
          <Logo size={30} />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/search"
            aria-label="البحث"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
          >
            <Search size={20} />
          </Link>
          <Link
            href="/notifications"
            aria-label="الإشعارات"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
          >
            <Bell size={20} />
          </Link>
        </div>
      </div>
      <nav className="flex gap-1 px-3 pb-2" aria-label="أقسام الموجز">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/?tab=${tab.key}`}
            className={
              tab.key === activeTab
                ? 'rounded-pill bg-ink px-4 py-1.5 text-sm font-bold text-white'
                : 'rounded-pill px-4 py-1.5 text-sm font-semibold text-ink-muted hover:bg-surface'
            }
          >
            {tab.label}
          </Link>
        ))}
        <Link
          href="/categories"
          className="rounded-pill px-4 py-1.5 text-sm font-semibold text-ink-muted hover:bg-surface"
        >
          الأقسام
        </Link>
      </nav>
    </header>
  );
}
