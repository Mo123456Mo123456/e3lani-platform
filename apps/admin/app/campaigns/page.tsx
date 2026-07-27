'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate, formatMoney } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

const statuses = ['PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

function formatTargeting(targeting: unknown) {
  if (!targeting || typeof targeting !== 'object') return 'استهداف غير محدد';
  const value = targeting as { cityIds?: string[]; categoryIds?: string[]; cityId?: string; categoryId?: string };
  const cityIds = value.cityIds ?? (value.cityId ? [value.cityId] : []);
  const categoryIds = value.categoryIds ?? (value.categoryId ? [value.categoryId] : []);
  const parts = [
    cityIds.length ? `مدن: ${cityIds.length}` : null,
    categoryIds.length ? `أقسام: ${categoryIds.length}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'كل المدن والأقسام';
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, any>>({});
  const [error, setError] = useState('');

  async function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    setCampaigns(await api.adminCampaigns());
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function updateStatus(id: string, status: string) {
    await api.adminUpdateCampaignStatus(id, status);
    await load();
  }

  async function loadReport(id: string) {
    const report = await api.adminCampaignReport(id);
    setReports((current) => ({ ...current, [id]: report }));
  }

  return (
    <div className="stack">
      <PageHeader title="الحملات" description="حملات المؤسسات والبراندات مع تحديث حالة الحملة." />
      <ErrorMessage message={error} />
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="panel stack">
          <div className="toolbar">
            <strong>{campaign.name}</strong>
            <StatusBadge>{campaign.status}</StatusBadge>
            <StatusBadge>{campaign.objective}</StatusBadge>
            <StatusBadge>{formatMoney(campaign.budgetTotal, campaign.currency)}</StatusBadge>
          </div>
          <div className="muted">
            {campaign.owner?.displayName || campaign.owner?.phone || campaign.ownerId} · {formatDate(campaign.updatedAt)}
          </div>
          <div className="muted">
            {campaign.startsAt ? `من ${formatDate(campaign.startsAt)}` : 'بدون بداية'} ·{' '}
            {campaign.endsAt ? `إلى ${formatDate(campaign.endsAt)}` : 'بدون نهاية'}
          </div>
          <div className="muted">{formatTargeting(campaign.targeting)}</div>
          {campaign.notes ? <p>{campaign.notes}</p> : null}
          <div className="toolbar">
            {(campaign.ads || []).map((row: any) => (
              <StatusBadge key={row.id}>{row.ad?.currentRevision?.title || row.ad?.id}</StatusBadge>
            ))}
          </div>
          <div className="toolbar">
            {campaign.status === 'ACTIVE' ? (
              <button className="btn btn-ghost" onClick={() => updateStatus(campaign.id, 'PAUSED')}>
                إيقاف مؤقت
              </button>
            ) : null}
            {campaign.status === 'PAUSED' ? (
              <button className="btn btn-ghost" onClick={() => updateStatus(campaign.id, 'ACTIVE')}>
                استئناف
              </button>
            ) : null}
            <button className="btn btn-ghost" onClick={() => loadReport(campaign.id)}>
              عرض التقرير
            </button>
            {statuses.map((status) => (
              <button
                key={status}
                className="btn btn-ghost"
                onClick={() => updateStatus(campaign.id, status)}
                disabled={campaign.status === status}
              >
                {status}
              </button>
            ))}
          </div>
          {reports[campaign.id] ? (
            <div className="toolbar">
              <StatusBadge>إعلانات: {reports[campaign.id].adCount}</StatusBadge>
              <StatusBadge>ظهور: {reports[campaign.id].metrics?.impressions ?? 0}</StatusBadge>
              <StatusBadge>نقرات: {reports[campaign.id].metrics?.clicks ?? 0}</StatusBadge>
              <StatusBadge>حفظ: {reports[campaign.id].metrics?.saves ?? 0}</StatusBadge>
            </div>
          ) : null}
        </div>
      ))}
      {campaigns.length === 0 && !error ? <EmptyState>لا توجد حملات.</EmptyState> : null}
    </div>
  );
}
