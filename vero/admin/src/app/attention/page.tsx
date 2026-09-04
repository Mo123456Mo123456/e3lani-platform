'use client';

import { useState } from 'react';
import { api, type AttentionItem } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { ATTENTION_AR, Empty, ErrorBox, Loading, fmtDateTime, useData } from '@/components/ui';

export default function AttentionPage() {
  const [kind, setKind] = useState('');
  const data = useData<{ items: AttentionItem[]; counts: Record<string, number> }>(() =>
    api('/v1/attention?perKind=100'),
  );

  const items = (data.data?.items ?? []).filter((i) => !kind || i.kind === kind);
  const kinds = Object.keys(data.data?.counts ?? {});

  return (
    <Shell title="تحتاج انتباه">
      <div className="alert info">
        <span>ℹ</span>
        <div>
          هذه الصفحة تعرض <b>الاستثناءات فقط</b> — لا تسرد آلاف النقاط الطبيعية. عالج ما هنا
          وستكون قد غطّيت يومك.
        </div>
      </div>

      <div className="toolbar">
        <button className={`btn sm ${kind === '' ? 'primary' : ''}`} onClick={() => setKind('')}>
          الكل <span className="num">({data.data?.items.length ?? 0})</span>
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            className={`btn sm ${kind === k ? 'primary' : ''}`}
            onClick={() => setKind(k)}
          >
            {ATTENTION_AR[k] ?? k} <span className="num">({data.data?.counts[k]})</span>
          </button>
        ))}
        <div className="spacer" />
        <button className="btn sm" onClick={data.reload}>
          تحديث
        </button>
      </div>

      <section className="card">
        {data.error != null ? (
          <div style={{ padding: 16 }}>
            <ErrorBox error={data.error} onRetry={data.reload} />
          </div>
        ) : data.loading ? (
          <div style={{ padding: 16 }}>
            <Loading rows={8} />
          </div>
        ) : items.length === 0 ? (
          <Empty icon="✅" title="لا توجد استثناءات" hint="كل شيء يسير كما هو مخطط" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>النوع</th>
                  <th>التفاصيل</th>
                  <th style={{ width: 150 }}>الوقت</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={`${it.entityId}-${i}`}>
                    <td>
                      <span
                        className={`pill ${
                          it.severity === 'HIGH' ? 'bad' : it.severity === 'MEDIUM' ? 'warn' : 'muted'
                        }`}
                      >
                        {ATTENTION_AR[it.kind] ?? it.kind}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{it.title}</div>
                      <div className="hint">{it.detail}</div>
                    </td>
                    <td className="hint">{it.at ? fmtDateTime(it.at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}
