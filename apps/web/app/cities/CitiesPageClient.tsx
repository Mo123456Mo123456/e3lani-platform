'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { City } from '@e3lani/api-client';
import { api } from '../../lib/api';
import { useLocale } from '../../lib/locale';

export default function CitiesPageClient() {
  const { locale } = useLocale();
  const [cities, setCities] = useState<City[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .cities('SA')
      .then(setCities)
      .catch((e) => setError((e as Error).message));
  }, []);

  const isAr = locale === 'ar';

  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">{isAr ? 'السعودية' : 'Saudi Arabia'}</span>
        <h1 style={{ margin: 0 }}>{isAr ? 'المدن' : 'Cities'}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {isAr
            ? 'اختر مدينة لمشاهدة الإعلانات المرئية النشطة فيها.'
            : 'Choose a city to browse active visual ads there.'}
        </p>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {!error && cities.length === 0 ? (
        <p className="muted">{isAr ? 'جاري تحميل المدن...' : 'Loading cities...'}</p>
      ) : null}

      <div className="grid-2">
        {cities.map((city) => (
          <Link key={city.id} className="panel stack card-link" href={`/search?city=${city.slug}`}>
            <strong>{isAr ? city.nameAr : city.nameEn}</strong>
            <span className="muted">{isAr ? city.nameEn : city.nameAr}</span>
            <span className="btn btn-ghost" style={{ width: 'fit-content' }}>
              {isAr ? 'تصفح الإعلانات' : 'Browse ads'}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
