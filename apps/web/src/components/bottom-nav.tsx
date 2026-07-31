import Link from 'next/link';
import { Bookmark, Grid3X3, Home, Plus, User } from 'lucide-react';

const ITEMS = [
  { key: 'home', href: '/', label: 'الرئيسية', icon: Home },
  { key: 'categories', href: '/categories', label: 'الأقسام', icon: Grid3X3 },
  { key: 'create', href: '/create', label: 'أضف إعلانًا', icon: Plus },
  { key: 'saved', href: '/saved', label: 'المحفوظات', icon: Bookmark },
  { key: 'account', href: '/account', label: 'حسابي', icon: User },
] as const;

export function BottomNav({ active }: { active: string }) {
  return (
    <nav
      className="sticky bottom-0 z-30 flex items-center justify-around border-t border-line bg-white/95 px-2 py-1.5 backdrop-blur"
      aria-label="التنقل الرئيسي"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isCreate = item.key === 'create';
        if (isCreate) {
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              className="grid h-12 w-12 place-items-center rounded-full bg-primary text-ink shadow-float transition-transform active:scale-95"
            >
              <Icon size={24} strokeWidth={2.6} />
            </Link>
          );
        }
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex min-w-16 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
              active === item.key ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            <Icon size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
