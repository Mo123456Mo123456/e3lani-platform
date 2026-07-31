'use client';

import * as React from 'react';
import Link from 'next/link';
import { Filter, Search as SearchIcon } from 'lucide-react';
import type { AdDto, CategoryDto, CityDto } from '@e3lani/types';
import { Badge, Button, EmptyState, Select, Spinner, formatPrice } from '@e3lani/ui';
import { search } from '@/lib/api';

interface Filters {
  q: string;
  cityId: string;
  categoryId: string;
  subcategoryId: string;
  mediaType: '' | 'IMAGE' | 'VIDEO';
  verifiedOnly: boolean;
  highlightedOnly: boolean;
  promotedOnly: boolean;
  nearMe: boolean;
  sort: 'latest' | 'most-viewed' | 'relevance';
}

/** البحث المتقدم مع كل الفلاتر المطلوبة. */
export function SearchClient({
  categories,
  cities,
  initialParams,
}: {
  categories: CategoryDto[];
  cities: CityDto[];
  initialParams: Record<string, string | undefined>;
}) {
  const [filters, setFilters] = React.useState<Filters>({
    q: initialParams.q ?? '',
    cityId: initialParams.cityId ?? '',
    categoryId: initialParams.categoryId ?? '',
    subcategoryId: '',
    mediaType: '',
    verifiedOnly: false,
    highlightedOnly: false,
    promotedOnly: false,
    nearMe: false,
    sort: 'latest',
  });
  const [showFilters, setShowFilters] = React.useState(false);
  const [items, setItems] = React.useState<AdDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);

  const subcategories =
    categories.find((category) => category.id === filters.categoryId)?.children ?? [];

  const run = React.useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const page = await search({
        q: filters.q || undefined,
        cityId: filters.cityId || undefined,
        categoryId: filters.categoryId || undefined,
        subcategoryId: filters.subcategoryId || undefined,
        mediaType: filters.mediaType || undefined,
        verifiedOnly: filters.verifiedOnly || undefined,
        highlightedOnly: filters.highlightedOnly || undefined,
        promotedOnly: filters.promotedOnly || undefined,
        nearMe: filters.nearMe || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        sort: filters.sort,
        limit: 20,
      });
      setItems(page.items);
    } finally {
      setLoading(false);
    }
  }, [filters, coords]);

  React.useEffect(() => {
    if (initialParams.q || initialParams.categoryId || initialParams.cityId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setFilters((current) => ({ ...current, nearMe: true }));
      },
      () => setFilters((current) => ({ ...current, nearMe: false })),
    );
  };

  const toggles: [keyof Filters, string][] = [
    ['verifiedOnly', 'الحسابات الموثقة'],
    ['highlightedOnly', 'الإعلانات المميزة'],
    ['promotedOnly', 'الإعلانات الممولة'],
  ];

  return (
    <div className="flex-1">
      <div className="sticky top-0 z-20 space-y-2 border-b border-line bg-white/95 p-3 backdrop-blur">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <SearchIcon
              size={18}
              className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="ابحث عن أي شيء…"
              aria-label="نص البحث"
              className="h-11 w-full rounded-lg border border-line bg-white pe-10 ps-3 text-[15px] e3-focus"
            />
          </div>
          <Button type="submit" size="md">
            بحث
          </Button>
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-label="الفلاتر"
            aria-expanded={showFilters}
            className="grid h-11 w-11 place-items-center rounded-lg border border-line"
          >
            <Filter size={18} />
          </button>
        </form>

        {showFilters ? (
          <div className="space-y-2 pb-1">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={filters.cityId}
                onChange={(event) => setFilters({ ...filters, cityId: event.target.value })}
                aria-label="المدينة"
              >
                <option value="">كل المدن</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.nameAr}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.categoryId}
                onChange={(event) =>
                  setFilters({ ...filters, categoryId: event.target.value, subcategoryId: '' })
                }
                aria-label="القسم"
              >
                <option value="">كل الأقسام</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nameAr}
                  </option>
                ))}
              </Select>
              {subcategories.length ? (
                <Select
                  value={filters.subcategoryId}
                  onChange={(event) => setFilters({ ...filters, subcategoryId: event.target.value })}
                  aria-label="القسم الفرعي"
                >
                  <option value="">كل الأقسام الفرعية</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nameAr}
                    </option>
                  ))}
                </Select>
              ) : null}
              <Select
                value={filters.mediaType}
                onChange={(event) =>
                  setFilters({ ...filters, mediaType: event.target.value as Filters['mediaType'] })
                }
                aria-label="نوع الوسائط"
              >
                <option value="">صور وفيديو</option>
                <option value="IMAGE">صور فقط</option>
                <option value="VIDEO">فيديو فقط</option>
              </Select>
              <Select
                value={filters.sort}
                onChange={(event) =>
                  setFilters({ ...filters, sort: event.target.value as Filters['sort'] })
                }
                aria-label="الترتيب"
              >
                <option value="latest">الأحدث</option>
                <option value="most-viewed">الأكثر مشاهدة</option>
                <option value="relevance">الأكثر ظهورًا</option>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={requestLocation}
                className={`rounded-pill border px-3 py-1.5 text-xs font-semibold ${
                  filters.nearMe ? 'border-primary bg-primary/20' : 'border-line'
                }`}
              >
                قريب مني
              </button>
              {toggles.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilters({ ...filters, [key]: !filters[key] } as Filters)}
                  className={`rounded-pill border px-3 py-1.5 text-xs font-semibold ${
                    filters[key] ? 'border-primary bg-primary/20' : 'border-line'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="p-3">
        {loading ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-2 gap-2">
            {items.map((ad) => (
              <Link key={ad.id} href={`/ad/${ad.id}`} className="overflow-hidden rounded-lg border border-line">
                <div className="aspect-[4/5] w-full bg-surface">
                  {ad.media[0]?.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ad.media[0].thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 text-sm font-semibold">{ad.title}</p>
                  {ad.price !== null ? (
                    <p className="text-sm font-bold">{formatPrice(ad.price)}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {ad.city ? <Badge tone="neutral">{ad.city.nameAr}</Badge> : null}
                    {ad.isHighlighted ? <Badge tone="primary">مميز</Badge> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : searched ? (
          <EmptyState title="لا توجد نتائج" description="جرّب كلمات أو فلاتر مختلفة." />
        ) : (
          <EmptyState title="ابحث عن أي شيء" description="سيارات، عقارات، خدمات، براندات…" />
        )}
      </div>
    </div>
  );
}
