'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdDetail, NotificationItem } from '@e3lani/api-client';
import { api, getToken, setToken } from '../../lib/api';
import { statusLabel } from '../../lib/status';

export default function AccountPage() {
  const router = useRouter();
  const [ads, setAds] = useState<AdDetail[]>([]);
  const [me, setMe] = useState<Record<string, unknown> | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');
  const [busyAdId, setBusyAdId] = useState<string | null>(null);

  async function loadAccount() {
    const [user, list, notes] = await Promise.all([api.me(), api.myAds(), api.notifications()]);
    setMe(user);
    setAds(list);
    setNotifications(notes);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadAccount().catch(() => router.replace('/login'));
  }, [router]);

  async function runAdAction(adId: string, action: 'pause' | 'resume' | 'republish' | 'extend') {
    setBusyAdId(adId);
    setError('');
    try {
      if (action === 'pause') await api.pauseAd(adId);
      if (action === 'resume') await api.resumeAd(adId);
      if (action === 'republish') await api.republishAd(adId);
      if (action === 'extend') await api.extendAd(adId);
      await loadAccount();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAdId(null);
    }
  }

  async function markAllRead() {
    setError('');
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function markRead(id: string) {
    try {
      await api.markNotificationRead(id);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <main className="container stack">
      <div className="panel stack">
        <h1 style={{ margin: 0 }}>حسابي</h1>
        <p className="muted">{String(me?.phone ?? '')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/ads/new">
            إعلان جديد
          </Link>
          <Link className="btn btn-ghost" href="/enterprise">
            حملات الشركات
          </Link>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setToken(null);
              router.push('/login');
            }}
          >
            خروج
          </button>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <section className="stack">
        <h2 style={{ marginBottom: 0 }}>إعلاناتي</h2>
        <div className="stack">
          {ads.map((ad) => {
            const canPause = ad.status === 'ACTIVE';
            const canResume = ad.status === 'PAUSED';
            const canExtend = ad.status === 'ACTIVE' || ad.status === 'PAUSED';
            const canRepublish = ad.status === 'EXPIRED';
            const canPay = ad.status === 'APPROVED_AWAITING_PAYMENT' || ad.status === 'PAYMENT_FAILED';
            const busy = busyAdId === ad.id;
            return (
              <div key={ad.id} className="panel stack">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div className="stack" style={{ gap: 6 }}>
                    <strong>{ad.currentRevision?.title}</strong>
                    <span className="badge">{statusLabel(ad.status)}</span>
                    <span className="muted">
                      {ad.currentRevision?.city?.nameAr} · {ad.currentRevision?.category?.nameAr}
                    </span>
                    {ad.expiresAt ? (
                      <span className="muted">ينتهي: {new Date(ad.expiresAt).toLocaleDateString('ar-SA')}</span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'start' }}>
                    <Link className="btn btn-ghost" href={`/ads/${ad.id}/status`}>
                      التفاصيل
                    </Link>
                    <Link className="btn btn-ghost" href={`/ads/${ad.id}`}>
                      عرض
                    </Link>
                    {canPay ? (
                      <Link className="btn btn-primary" href={`/ads/${ad.id}/pay`}>
                        الدفع
                      </Link>
                    ) : null}
                    {canPause ? (
                      <button className="btn btn-ghost" onClick={() => runAdAction(ad.id, 'pause')} disabled={busy}>
                        إيقاف مؤقت
                      </button>
                    ) : null}
                    {canResume ? (
                      <button className="btn btn-primary" onClick={() => runAdAction(ad.id, 'resume')} disabled={busy}>
                        استئناف
                      </button>
                    ) : null}
                    {canExtend ? (
                      <button className="btn btn-ghost" onClick={() => runAdAction(ad.id, 'extend')} disabled={busy}>
                        تمديد 15 يومًا
                      </button>
                    ) : null}
                    {canRepublish ? (
                      <button className="btn btn-primary" onClick={() => runAdAction(ad.id, 'republish')} disabled={busy}>
                        إعادة نشر
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {ads.length === 0 ? <p className="muted">لا توجد إعلانات بعد.</p> : null}
        </div>
      </section>

      <section className="stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>التنبيهات</h2>
          {notifications.length > 0 ? (
            <button className="btn btn-ghost" onClick={markAllRead} disabled={unreadCount === 0}>
              قراءة الكل {unreadCount ? `(${unreadCount})` : ''}
            </button>
          ) : null}
        </div>
        <div className="stack">
          {notifications.slice(0, 8).map((notification) => (
            <button
              key={notification.id}
              className="panel notification-card"
              onClick={() => markRead(notification.id)}
              style={{ textAlign: 'start', cursor: 'pointer' }}
            >
              <span className="badge">{notification.readAt ? 'مقروء' : 'جديد'}</span>
              <strong>{notification.titleAr || notification.titleEn}</strong>
              <span className="muted">{notification.bodyAr || notification.bodyEn}</span>
              <small className="muted">{new Date(notification.createdAt).toLocaleString('ar-SA')}</small>
            </button>
          ))}
          {notifications.length === 0 ? <p className="muted">لا توجد تنبيهات بعد.</p> : null}
        </div>
      </section>
    </main>
  );
}
