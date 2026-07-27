'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { t, type AppLocale } from '@e3lani/i18n';

type LocaleCtx = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  dir: 'rtl' | 'ltr';
  tr: (key: Parameters<typeof t>[1]) => string;
};

const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ar');

  useEffect(() => {
    const saved = window.localStorage.getItem('e3lani_locale');
    if (saved === 'ar' || saved === 'en') setLocaleState(saved);
  }, []);

  const setLocale = (next: AppLocale) => {
    setLocaleState(next);
    window.localStorage.setItem('e3lani_locale', next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo<LocaleCtx>(
    () => ({
      locale,
      setLocale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      tr: (key) => t(locale, key),
    }),
    [locale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocale requires LocaleProvider');
  return ctx;
}
