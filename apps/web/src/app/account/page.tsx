'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, LogOut, Pencil, Rocket } from 'lucide-react';
import type { AdDto, PaginatedDto, SessionUserDto } from '@e3lani/types';
import { Avatar, Badge, Button, Card, EmptyState, Spinner, formatPrice, timeAgo } from '@e3lani/ui';
import { authedFetch, getMe, session } from '@/lib/session';
import { BottomNav } from '@/components/bottom-nav';

const STATUS_LABELS: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: 'مسودة', tone: 'neutral' },
  PENDING_PAYMENT: { label: 'بانتظار الدفع', tone: 'warning' },
  ACTIVE: { label: 'نشط', tone: 'success' },
  PAUSED: { label: 'متوقف', tone: 'warning' },
  EXPIRED: { label: 'منتهي', tone: 'neutral' },
  REJECTED: { label: 'مرفوض', tone: 'danger' },
  REMOVED: { label: 'محذوف', tone: 'danger' },
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUserDto | null>(null);
  const [ads, setAds] = React.useState<AdDto[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!session.accessToken()) {
      router.replace('/login?next=/account');
      return;
    }
    void (async () => {
      try {
        const [me, myAds] = await Promise.all([
          getMe(),
          authedFetch<PaginatedDto<AdDto>>('/ads/mine?limit=20'),
        ]);
        setUser(me);
        setAds(myAds.items);
      } catch {
        session.clear();
        router.replace('/login?next=/account');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const logout = async () => {
    await authedFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken() }),
    }).catch(() => undefined);
    session.clear();
    router.replace('/');
  };

  const publish = async (adId: string) => {
    const updated = await authedFetch<AdDto>(`/ads/${adId}/publish`, { method: 'POST' });
    setAds((current) => current.map((ad) => (ad.id === adId ? updated : ad)));
  };

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-x border-line bg-white">
      <header className="flex items-center gap-3 border-b border-line p-4">
        <Avatar src={user?.avatarUrl} name={user?.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold">{user?.name ?? 'حسابي'}</h1>
          <p className="text-sm text-ink-muted">{user?.phone}</p>
        </div>
        <button onClick={logout} aria-label="تسجيل الخروج" className="grid h-10 w-10 place-items-center rounded-full border border-line">
          <LogOut size={18} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 p-3">
        <Link href="/create">
          <Button fullWidth>
            <Rocket size={17} /> أضف إعلانًا
          </Button>
        </Link>
        <Link href={`/u/${user?.id}`}>
          <Button variant="outline" fullWidth>
            صفحتي العامة
          </Button>
        </Link>
      </div>

      <section className="flex-1 space-y-2 p-3">
        <h2 className="text-base font-extrabold">إعلاناتي</h2>
        {ads.length ? (
          ads.map((ad) => {
            const status = STATUS_LABELS[ad.status] ?? { label: ad.status, tone: 'neutral' as const };
            return (
              <Card key={ad.id} className="flex gap-3 p-3">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md bg-surface">
                  {ad.media[0]?.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.media[0].thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/ad/${ad.id}`} className="line-clamp-1 font-bold">
                      {ad.title}
                    </Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  {ad.price !== null ? (
                    <p className="text-sm font-semibold">{formatPrice(ad.price)}</p>
                  ) : null}
                  <p className="text-xs text-ink-muted">
                    {ad.publishedAt ? timeAgo(ad.publishedAt) : 'لم يُنشر بعد'} · {ad.viewsCount} مشاهدة
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['DRAFT', 'EXPIRED', 'PAUSED'].includes(ad.status) ? (
                      <Button size="sm" onClick={() => void publish(ad.id)}>
                        نشر
                      </Button>
                    ) : null}
                    <Link href={`/create?adId=${ad.id}`}>
                      <Button size="sm" variant="outline">
                        <Pencil size={14} /> تعديل
                      </Button>
                    </Link>
                    <Link href={`/account/analytics/${ad.id}`}>
                      <Button size="sm" variant="ghost">
                        <BarChart3 size={14} /> التحليلات
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState
            title="لم تنشر أي إعلان بعد"
            description="أضف أول إعلان لك خلال دقيقة."
            action={
              <Link href="/create">
                <Button>أضف إعلانًا</Button>
              </Link>
            }
          />
        )}
      </section>

      <BottomNav active="account" />
    </div>
  );
}
