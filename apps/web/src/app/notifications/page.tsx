'use client';

import * as React from 'react';
import Link from 'next/link';
import type { NotificationDto, PaginatedDto } from '@e3lani/types';
import { Button, EmptyState, Spinner, timeAgo } from '@e3lani/ui';
import { authedFetch, session } from '@/lib/session';
import { BottomNav } from '@/components/bottom-nav';

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [authed, setAuthed] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!session.accessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    try {
      const page = await authedFetch<PaginatedDto<NotificationDto> & { unreadCount: number }>(
        '/notifications?limit=30',
      );
      setItems(page.items);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const markAll = async () => {
    await authedFetch('/notifications/read-all', { method: 'POST' });
    void load();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-x border-line bg-white">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h1 className="text-lg font-extrabold">الإشعارات</h1>
        {items.some((item) => !item.readAt) ? (
          <button onClick={markAll} className="text-sm font-semibold text-ink-muted">
            تعليم الكل كمقروء
          </button>
        ) : null}
      </header>

      <div className="flex-1 divide-y divide-line">
        {!authed ? (
          <div className="p-4">
            <EmptyState
              title="سجّل الدخول لعرض إشعاراتك"
              action={
                <Link href="/login?next=/notifications">
                  <Button>تسجيل الدخول</Button>
                </Link>
              }
            />
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : items.length ? (
          items.map((item) => (
            <article key={item.id} className={item.readAt ? 'p-4' : 'bg-primary/5 p-4'}>
              <h2 className="font-bold">{item.titleAr}</h2>
              <p className="mt-1 text-sm text-ink-muted">{item.bodyAr}</p>
              <time className="mt-1 block text-xs text-ink-muted">{timeAgo(item.createdAt)}</time>
            </article>
          ))
        ) : (
          <div className="p-4">
            <EmptyState title="لا توجد إشعارات" />
          </div>
        )}
      </div>

      <BottomNav active="account" />
    </div>
  );
}
