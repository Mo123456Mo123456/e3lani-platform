'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getToken } from '../lib/api';

export function AppChrome({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(Boolean(getToken()));
  }, []);

  return (
    <div className="app-shell">
      <header className="topnav">
        <nav className="nav-links" aria-label="Primary">
          <Link href="/browse">تصفح</Link>
          <Link href="/categories">الأقسام</Link>
          <Link href="/ads/new">أضف إعلان</Link>
          <Link href="/saved">المحفوظات</Link>
          <Link href="/account">حسابي</Link>
          <Link href="/pricing">الأسعار</Link>
          {!authed ? <Link href="/login">دخول</Link> : null}
        </nav>
        <Link href="/" className="brand">
          <span>إعلاني</span>
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
            <path d="M10 48C18 34 28 22 42 10L50 18C38 28 28 38 20 52L10 48Z" fill="#FFC400" />
            <path d="M22 50C28 40 36 30 48 20L54 26C44 34 36 42 30 52L22 50Z" fill="#FFC400" opacity=".75" />
          </svg>
        </Link>
      </header>
      {children}
    </div>
  );
}
