'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate, formatMoney } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

const statuses = ['PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
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
          {campaign.notes ? <p>{campaign.notes}</p> : null}
          <div className="toolbar">
            {(campaign.ads || []).map((row: any) => (
              <StatusBadge key={row.id}>{row.ad?.currentRevision?.title || row.ad?.id}</StatusBadge>
            ))}
          </div>
          <div className="toolbar">
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
        </div>
      ))}
      {campaigns.length === 0 && !error ? <EmptyState>لا توجد حملات.</EmptyState> : null}
    </div>
  );
}
