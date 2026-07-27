'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getToken } from '../lib/api';
import { useLocale } from '../lib/locale';

export function AppChrome({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, tr } = useLocale();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(Boolean(getToken()));
  }, []);

  return (
    <div className="app-shell">
      <header className="topnav">
        <Link href="/" className="brand" aria-label="إعلاني | E3lani">
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
            <path d="M10 48C18 34 28 22 42 10L50 18C38 28 28 38 20 52L10 48Z" fill="#FFC400" />
            <path d="M22 50C28 40 36 30 48 20L54 26C44 34 36 42 30 52L22 50Z" fill="#FFC400" opacity=".75" />
          </svg>
          <span className="brand-lockup">
            <strong>إعلاني | E3lani</strong>
            <small>{tr('brand.tagline')}</small>
          </span>
        </Link>

        <nav className="nav-links" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Primary'}>
          <Link href="/browse">{tr('nav.home')}</Link>
          <Link href="/search">{locale === 'ar' ? 'بحث' : 'Search'}</Link>
          <Link href="/categories">{tr('nav.categories')}</Link>
          <Link href="/cities">{locale === 'ar' ? 'المدن' : 'Cities'}</Link>
          <Link href="/saved">{tr('nav.saved')}</Link>
          <Link href="/account">{tr('nav.account')}</Link>
          <Link href="/pricing">{locale === 'ar' ? 'الأسعار' : 'Pricing'}</Link>
          <Link href="/enterprise">{locale === 'ar' ? 'للشركات' : 'Enterprise'}</Link>
          {!authed ? <Link href="/login">{locale === 'ar' ? 'دخول' : 'Login'}</Link> : null}
          <button
            type="button"
            className="lang-toggle"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label="Language"
          >
            {locale === 'ar' ? 'EN' : 'ع'}
          </button>
        </nav>

        <Link href="/ads/new" className="nav-add" aria-label={tr('nav.add')}>
          <span>+</span>
          <em>{tr('nav.add')}</em>
        </Link>
      </header>
      {children}
    </div>
  );
}
