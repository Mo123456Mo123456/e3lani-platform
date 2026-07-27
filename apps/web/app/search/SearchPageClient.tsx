'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AdDetail, Category, City, FeedSearchFilters } from '@e3lani/api-client';
import { api } from '../../lib/api';
import { useLocale } from '../../lib/locale';

type SortValue = NonNullable<FeedSearchFilters['sort']>;
type KindValue = NonNullable<FeedSearchFilters['kind']>;

function matchByIdOrSlug<T extends { id: string; slug: string }>(items: T[], value: string | null) {
  if (!value) return '';
  return items.find((item) => item.id === value || item.slug === value)?.id ?? '';
}

export default function SearchPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useLocale();
  const isAr = locale === 'ar';

  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [items, setItems] = useState<AdDetail[]>([]);
  const [q, setQ] = useState('');
  const [cityId, setCityId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [kind, setKind] = useState<'' | KindValue>('');
  const [sort, setSort] = useState<SortValue>('latest');
  const [featured, setFeatured] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const paramsKey = params.toString();

  useEffect(() => {
    Promise.all([api.categories(), api.cities('SA')])
      .then(([cats, cts]) => {
        setCategories(cats);
        setCities(cts);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (categories.length === 0 && cities.length === 0) return;
    const rawCity = params.get('cityId') ?? params.get('city');
    const rawCategory = params.get('categoryId') ?? params.get('category');
    setQ(params.get('q') ?? '');
    setCityId(matchByIdOrSlug(cities, rawCity));
    setCategoryId(matchByIdOrSlug(categories, rawCategory));
    const nextKind = params.get('kind');
    setKind(nextKind === 'image' || nextKind === 'video' ? nextKind : '');
    const nextSort = params.get('sort');
    setSort(nextSort === 'views' || nextSort === 'featured' ? nextSort : 'latest');
    setFeatured(params.get('featured') === 'true' || params.get('featured') === '1');
    setCursor(undefined);
  }, [categories, cities, paramsKey]);

  const filters = useMemo<FeedSearchFilters>(
    () => ({
      q: q.trim() || undefined,
      cityId: cityId || undefined,
      categoryId: categoryId || undefined,
      kind: kind || undefined,
      sort,
      featured: featured || undefined,
      cursor,
      take: 12,
    }),
    [categoryId, cityId, cursor, featured, kind, q, sort],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .searchFeed(filters)
      .then((page) => {
        if (!alive) return;
        setItems((current) => (filters.cursor ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (q.trim()) query.set('q', q.trim());
    const city = cities.find((item) => item.id === cityId);
    const category = categories.find((item) => item.id === categoryId);
    if (city) query.set('city', city.slug);
    if (category) query.set('category', category.slug);
    if (kind) query.set('kind', kind);
    if (sort !== 'latest') query.set('sort', sort);
    if (featured) query.set('featured', 'true');
    setCursor(undefined);
    router.push(`/search${query.toString() ? `?${query.toString()}` : ''}`);
  }

  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">{isAr ? 'بحث وفلاتر' : 'Search and filters'}</span>
        <h1 style={{ margin: 0 }}>{isAr ? 'ابحث في الإعلانات' : 'Search ads'}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {isAr
            ? 'استخدم الكلمة المفتاحية والمدينة والقسم ونوع الوسائط للوصول للإعلان المناسب.'
            : 'Use keywords, city, category, and media type to find relevant ads.'}
        </p>
      </section>

      <form className="panel grid-2" onSubmit={submit}>
        <label className="stack">
          <span>{isAr ? 'كلمة البحث' : 'Keyword'}</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="E3lani" />
        </label>
        <label className="stack">
          <span>{isAr ? 'المدينة' : 'City'}</span>
          <select className="select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">{isAr ? 'كل المدن' : 'All cities'}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {isAr ? city.nameAr : city.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="stack">
          <span>{isAr ? 'القسم' : 'Category'}</span>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{isAr ? 'كل الأقسام' : 'All categories'}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {isAr ? category.nameAr : category.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="stack">
          <span>{isAr ? 'نوع الوسائط' : 'Media type'}</span>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as '' | KindValue)}>
            <option value="">{isAr ? 'صور وفيديو' : 'Images and video'}</option>
            <option value="image">{isAr ? 'صور' : 'Images'}</option>
            <option value="video">{isAr ? 'فيديو' : 'Video'}</option>
          </select>
        </label>
        <label className="stack">
          <span>{isAr ? 'الترتيب' : 'Sort'}</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortValue)}>
            <option value="latest">{isAr ? 'الأحدث' : 'Latest'}</option>
            <option value="featured">{isAr ? 'المميزة أولًا' : 'Featured first'}</option>
            <option value="views">{isAr ? 'الأكثر مشاهدة' : 'Most viewed'}</option>
          </select>
        </label>
        <label className="stack" style={{ justifyContent: 'end' }}>
          <span>{isAr ? 'مميز' : 'Featured'}</span>
          <span className="panel" style={{ padding: 12 }}>
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />{' '}
            {isAr ? 'الإعلانات المميزة فقط' : 'Featured ads only'}
          </span>
        </label>
        <button className="btn btn-primary" type="submit">
          {isAr ? 'تطبيق الفلاتر' : 'Apply filters'}
        </button>
        <Link className="btn btn-ghost" href="/search">
          {isAr ? 'مسح' : 'Clear'}
        </Link>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {loading && items.length === 0 ? <p className="muted">{isAr ? 'جاري البحث...' : 'Searching...'}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="muted">{isAr ? 'لا توجد نتائج مطابقة.' : 'No matching ads found.'}</p>
      ) : null}

      <div className="grid-2">
        {items.map((ad) => {
          const media = ad.media?.[0]?.asset;
          const title = ad.currentRevision?.title ?? (isAr ? 'إعلان' : 'Ad');
          return (
            <Link key={ad.id} className="panel search-result-card" href={`/ads/${ad.id}`}>
              <div className="thumb">
                {media?.kind === 'VIDEO' ? (
                  <video src={media.urls?.playback} poster={media.urls?.poster ?? undefined} muted playsInline />
                ) : media ? (
                  <img src={media.urls?.playback || media.urls?.source} alt={title} />
                ) : null}
              </div>
              <div className="stack">
                <strong>{title}</strong>
                <span className="muted">
                  {isAr ? ad.currentRevision?.city?.nameAr : ad.currentRevision?.city?.nameEn} ·{' '}
                  {isAr ? ad.currentRevision?.category?.nameAr : ad.currentRevision?.category?.nameEn}
                </span>
                <span className="badge">{ad.owner?.brandProfile?.nameAr || ad.owner?.displayName || 'E3lani'}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {nextCursor ? (
        <button className="btn btn-dark" type="button" onClick={() => setCursor(nextCursor)} disabled={loading}>
          {loading ? (isAr ? 'جاري التحميل...' : 'Loading...') : isAr ? 'تحميل المزيد' : 'Load more'}
        </button>
      ) : null}
    </main>
  );
}
