'use client';

import { useEffect, useState } from 'react';
import type { AdDetail } from '@e3lani/api-client';
import { api, getToken } from '../../../lib/api';

export default function AdsReviewPage() {
  const [items, setItems] = useState<AdDetail[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    const queue = await api.adminReviewQueue();
    setItems(queue);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function act(id: string, action: 'approve' | 'needs' | 'reject') {
    const note = notes[id] || (action === 'approve' ? 'مقبول' : 'مطلوب تعديل');
    if (action === 'approve') await api.adminApprove(id, note);
    if (action === 'needs') await api.adminNeedsChanges(id, note);
    if (action === 'reject') await api.adminReject(id, note);
    await load();
  }

  return (
    <div className="stack">
      <h2 style={{ marginTop: 0 }}>مراجعة الإعلانات</h2>
      <p className="muted">DRAFT أُرسلت → PENDING_REVIEW → قبول/تعديل/رفض. الدفع بعد القبول فقط.</p>
      {error ? <p style={{ color: '#b00020' }}>{error}</p> : null}
      {items.map((ad) => {
        const media = ad.media?.[0]?.asset;
        return (
          <div key={ad.id} className="panel stack">
            <strong>{ad.currentRevision?.title}</strong>
            <div className="muted">
              {ad.currentRevision?.city?.nameAr} · {ad.owner?.displayName || ad.owner?.id}
            </div>
            {media ? (
              media.kind === 'VIDEO' ? (
                <video controls style={{ width: '100%', maxHeight: 280, borderRadius: 12 }} src={media.urls?.playback} poster={media.urls?.poster ?? undefined} />
              ) : (
                <img alt="" src={media.urls?.playback || media.urls?.source} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 12 }} />
              )
            ) : null}
            <textarea
              className="textarea"
              placeholder="ملاحظات المراجعة"
              value={notes[ad.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [ad.id]: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => act(ad.id, 'approve')}>قبول</button>
              <button className="btn btn-ghost" onClick={() => act(ad.id, 'needs')}>طلب تعديل</button>
              <button className="btn btn-dark" onClick={() => act(ad.id, 'reject')}>رفض</button>
            </div>
          </div>
        );
      })}
      {items.length === 0 ? <p className="muted">لا توجد إعلانات بانتظار المراجعة.</p> : null}
    </div>
  );
}
