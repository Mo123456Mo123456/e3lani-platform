import type { Metadata } from 'next';
import CitiesPageClient from './CitiesPageClient';

export const metadata: Metadata = {
  title: 'المدن | إعلاني',
  description: 'تصفح إعلانات إعلاني حسب مدن السعودية.',
  alternates: { canonical: '/cities' },
};

export default function CitiesPage() {
  return <CitiesPageClient />;
}
