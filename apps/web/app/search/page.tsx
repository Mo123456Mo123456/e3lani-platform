import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchPageClient from './SearchPageClient';

export const metadata: Metadata = {
  title: 'البحث | إعلاني',
  description: 'ابحث في إعلانات إعلاني حسب المدينة والقسم ونوع الوسائط.',
  alternates: { canonical: '/search' },
};

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="container"><p className="muted">جاري التحميل...</p></main>}>
      <SearchPageClient />
    </Suspense>
  );
}
