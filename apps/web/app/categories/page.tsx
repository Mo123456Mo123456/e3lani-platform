'use client';

import { useEffect, useState } from 'react';
import type { Category } from '@e3lani/api-client';
import { api } from '../../lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    api.categories().then(setCategories).catch(console.error);
  }, []);

  return (
    <main className="container">
      <h1>الأقسام</h1>
      <div className="grid-2">
        {categories.map((c) => (
          <div key={c.id} className="panel">
            <strong>{c.nameAr}</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              {c.nameEn}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
