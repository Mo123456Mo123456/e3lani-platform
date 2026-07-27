'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Category } from '@e3lani/api-client';
import { api } from '../../lib/api';
import { useLocale } from '../../lib/locale';

export default function CategoriesPage() {
  const { locale } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    api.categories().then(setCategories).catch(console.error);
  }, []);

  return (
    <main className="container">
      <h1>الأقسام</h1>
      <div className="grid-2">
        {categories.map((c) => (
          <Link key={c.id} className="panel card-link" href={`/search?category=${c.slug}`}>
            <strong>{locale === 'ar' ? c.nameAr : c.nameEn}</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              {locale === 'ar' ? c.nameEn : c.nameAr}
            </p>
            <span className="btn btn-ghost" style={{ width: 'fit-content', marginTop: 12 }}>
              {locale === 'ar' ? 'تصفح القسم' : 'Browse category'}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
