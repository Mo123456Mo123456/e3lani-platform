'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import type { AdAnalyticsDto } from '@e3lani/types';
import { Card, Spinner, formatNumber } from '@e3lani/ui';
import { authedFetch } from '@/lib/session';

const HOURS = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export default function AdAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<AdAnalyticsDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void authedFetch<AdAnalyticsDto>(`/ads/${params.id}/analytics`)
      .then(setData)
      .catch((err) => setError(err.message ?? 'تعذّر تحميل التحليلات'));
  }, [params.id]);

  if (error) return <main className="p-6 text-center text-danger">{error}</main>;
  if (!data)
    return (
      <main className="grid min-h-dvh place-items-center">
        <Spinner />
      </main>
    );

  const stats: [string, string][] = [
    ['مرات الظهور', formatNumber(data.impressions)],
    ['الوصول الفريد', formatNumber(data.uniqueReach)],
    ['مشاهدات الفيديو', formatNumber(data.videoViews)],
    ['متوسط مدة المشاهدة', `${(data.averageWatchMs / 1000).toFixed(1)} ث`],
    ['نسبة الإكمال', `${Math.round(data.completionRate * 100)}%`],
    ['إجمالي النقرات', formatNumber(data.clicks.total)],
    ['نقرات واتساب', formatNumber(data.clicks.whatsapp)],
    ['نقرات الاتصال', formatNumber(data.clicks.call)],
    ['نقرات المتجر', formatNumber(data.clicks.store)],
    ['نقرات الرابط', formatNumber(data.clicks.link)],
    ['الحفظ', formatNumber(data.saves)],
    ['المشاركات', formatNumber(data.shares)],
    ['ظهور طبيعي', formatNumber(data.bySource.ORGANIC)],
    ['ظهور مدفوع', formatNumber(data.bySource.PROMOTED)],
  ];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[520px] space-y-4 p-4">
      <h1 className="text-xl font-extrabold">تحليلات الإعلان</h1>

      <div className="grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="text-lg font-extrabold">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-2 p-4">
        <h2 className="font-bold">أفضل أداء</h2>
        <p className="text-sm text-ink-muted">
          أفضل يوم: {data.bestDay ? `${data.bestDay.date} (${data.bestDay.impressions})` : 'لا توجد بيانات'}
        </p>
        <p className="text-sm text-ink-muted">
          أفضل ساعة: {data.bestHour ? `${HOURS(data.bestHour.hour)} (${data.bestHour.impressions})` : 'لا توجد بيانات'}
        </p>
      </Card>

      {data.topCities.length ? (
        <Card className="space-y-2 p-4">
          <h2 className="font-bold">أفضل المدن</h2>
          <ul className="space-y-1 text-sm">
            {data.topCities.map((city) => (
              <li key={city.cityId} className="flex justify-between">
                <span>{city.nameAr}</span>
                <span className="font-bold">{formatNumber(city.impressions)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </main>
  );
}
