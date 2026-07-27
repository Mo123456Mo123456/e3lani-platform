import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { t as translate, type AppLocale, type MessageKey } from '@e3lani/i18n';

type LocaleContextValue = {
  locale: AppLocale;
  isRtl: boolean;
  textAlign: 'right' | 'left';
  rowDirection: 'row-reverse' | 'row';
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>('ar');

  const value = useMemo<LocaleContextValue>(() => {
    const isRtl = locale === 'ar';
    return {
      locale,
      isRtl,
      textAlign: isRtl ? 'right' : 'left',
      rowDirection: isRtl ? 'row-reverse' : 'row',
      setLocale,
      toggleLocale: () => setLocale((current) => (current === 'ar' ? 'en' : 'ar')),
      t: (key) => translate(locale, key),
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}
