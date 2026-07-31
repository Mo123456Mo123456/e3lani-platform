'use client';

import * as React from 'react';
import Link from 'next/link';
import { halalasToSar } from '@e3lani/config';
import { Card, Spinner, formatNumber } from '@e3lani/ui';
import { AdminShell } from '@/components/admin-shell';
import { adminFetch } from '@/lib/admin-api';

interface Overview {
  users: number;
  businesses: number;
  activeAds: number;
  posts: number;
  pendingReports: number;
  tickerActive: number;
  revenueHalalas: number;
  paymentsCount: number;
  newUsers: number;
  newAds: number;
  rangeDays: number;
}

export default function OverviewPage() {
  const [data, setData] = React.useState<Overview | null>(null);

  React.useEffect(() => {
    void adminFetch<Overview>('/admin/overview').then(setData).catch(() => undefined);
  }, []);

  return (
    <AdminShell title="نظرة عامة">
      {!data ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['المستخدمون النشطون', formatNumber(data.users)],
                ['الحسابات التجارية', formatNumber(data.businesses)],
                ['الإعلانات النشطة', formatNumber(data.activeAds)],
                ['المنشورات المجانية', formatNumber(data.posts)],
                ['بلاغات قيد المعالجة', formatNumber(data.pendingReports)],
                ['شعارات الشريط النشطة', formatNumber(data.tickerActive)],
                [`إيرادات آخر ${data.rangeDays} يومًا`, `${formatNumber(halalasToSar(data.revenueHalalas))} ر.س`],
                ['عمليات الدفع', formatNumber(data.paymentsCount)],
                [`مستخدمون جدد (${data.rangeDays} يوم)`, formatNumber(data.newUsers)],
                [`إعلانات جديدة (${data.rangeDays} يوم)`, formatNumber(data.newAds)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="mt-1 text-2xl font-extrabold">{value}</p>
              </Card>
            ))}
          </div>

          {data.pendingReports > 0 ? (
            <Card className="flex items-center justify-between gap-3 border-warning/40 bg-warning/10 p-4">
              <p className="text-sm font-semibold">
                لديك {formatNumber(data.pendingReports)} بلاغًا بانتظار المراجعة.
              </p>
              <Link href="/reports" className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">
                مراجعة البلاغات
              </Link>
            </Card>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
