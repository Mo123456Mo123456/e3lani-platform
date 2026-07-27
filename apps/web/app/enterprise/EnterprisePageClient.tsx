'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { Campaign, Category, City } from '@e3lani/api-client';
import { api, apiBaseUrl, getToken } from '../../lib/api';
import { useLocale } from '../../lib/locale';

type CampaignTargeting = {
  cityIds?: string[];
  categoryIds?: string[];
};

function dateToIso(value: string) {
  return value ? new Date(`${value}T09:00:00+03:00`).toISOString() : undefined;
}

function describeTargeting(campaign: Campaign, isAr: boolean) {
  const targeting = (campaign.targeting ?? {}) as CampaignTargeting;
  const cityIds = targeting.cityIds ?? [];
  const categoryIds = targeting.categoryIds ?? [];
  const parts = [
    cityIds.length ? `${isAr ? 'مدن' : 'Cities'}: ${cityIds.length}` : null,
    categoryIds.length ? `${isAr ? 'أقسام' : 'Categories'}: ${categoryIds.length}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : isAr ? 'كل المدن والأقسام' : 'All cities and categories';
}

async function campaignTransition(id: string, action: 'pause' | 'resume'): Promise<Campaign> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}/${action}`, {
    method: 'POST',
    headers,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      data && typeof data === 'object' && 'message' in data ? String(data.message) : `HTTP ${res.status}`,
    );
  }
  return data as Campaign;
}

export default function EnterprisePageClient() {
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const [authed, setAuthed] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('views');
  const [budget, setBudget] = useState('5000');
  const [cityId, setCityId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
    Promise.all([api.cities('SA'), api.categories()])
      .then(([cts, cats]) => {
        setCities(cts);
        setCategories(cats);
      })
      .catch(() => undefined);
    if (getToken()) {
      api.myCampaigns().then(setCampaigns).catch(() => undefined);
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const campaign = await api.createCampaign({
        name,
        objective,
        budgetTotal: Number(budget),
        currency: 'SAR',
        startsAt: dateToIso(startsAt),
        endsAt: dateToIso(endsAt),
        targeting: {
          ...(cityId ? { cityIds: [cityId] } : {}),
          ...(categoryId ? { categoryIds: [categoryId] } : {}),
        },
        notes: notes || undefined,
      });
      setCampaigns((current) => [campaign, ...current]);
      setMessage(isAr ? 'تم إنشاء طلب الحملة بنجاح.' : 'Campaign request created.');
      setName('');
      setNotes('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function transitionCampaign(id: string, action: 'pause' | 'resume') {
    setError('');
    try {
      const updated =
        action === 'pause' ? await campaignTransition(id, 'pause') : await campaignTransition(id, 'resume');
      setCampaigns((current) => current.map((campaign) => (campaign.id === id ? updated : campaign)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">{isAr ? 'للشركات والبراندات' : 'For companies and brands'}</span>
        <div className="notice">
          <strong>
            {isAr
              ? 'مسودات قانونية / Legal drafts pending counsel review'
              : 'Legal drafts pending counsel review / مسودات قانونية'}
          </strong>
          <p className="muted" style={{ margin: 0 }}>
            {isAr
              ? 'معلومات حملات الشركات هنا مسودة قانونية بانتظار مراجعة مستشار قانوني وليست شروطًا نهائية أو نصيحة قانونية.'
              : 'Enterprise campaign information here is an operational legal draft pending counsel review and is not final legal advice.'}
          </p>
        </div>
        <h1 style={{ margin: 0 }}>{isAr ? 'حملات إعلانية مرئية على إعلاني' : 'Visual campaigns on E3lani'}</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
          {isAr
            ? 'خطط حملات إطلاق، زيارات، رعايات، مواسم، أو حملات متعددة الإعلانات مع استهداف المدن والأقسام في السعودية.'
            : 'Plan launches, visits, sponsorships, seasonal campaigns, and multi-ad campaigns with city and category targeting across Saudi Arabia.'}
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/ads/new">
            {isAr ? 'أنشئ إعلانًا أولًا' : 'Create an ad first'}
          </Link>
          <Link className="btn btn-dark" href={authed ? '#campaign-form' : '/login'}>
            {authed ? (isAr ? 'ابدأ طلب حملة' : 'Start campaign request') : isAr ? 'سجل الدخول للمتابعة' : 'Login to continue'}
          </Link>
        </div>
      </section>

      <section className="grid-2">
        {[
          [isAr ? 'أهداف واضحة' : 'Clear objectives', isAr ? 'مشاهدات، زيارات، افتتاح، رعاية، أو إطلاق منتج.' : 'Views, visits, openings, sponsorships, or product launches.'],
          [isAr ? 'استهداف محلي' : 'Local targeting', isAr ? 'مدن وأقسام مناسبة للجمهور السعودي.' : 'Saudi city and category targeting.'],
          [isAr ? 'قياس ومتابعة' : 'Measurement', isAr ? 'ربط الحملة بالإعلانات ومتابعة الحالة والنتائج.' : 'Connect campaigns to ads and track status and results.'],
          [isAr ? 'دعم تشغيلي' : 'Operational support', isAr ? 'مسار مناسب للمعلنين الكبار ومديري الحملات.' : 'A workflow for larger advertisers and campaign managers.'],
        ].map(([title, body]) => (
          <div key={title} className="panel stack">
            <strong>{title}</strong>
            <p className="muted" style={{ margin: 0 }}>
              {body}
            </p>
          </div>
        ))}
      </section>

      <section id="campaign-form" className="panel stack">
        <h2 style={{ margin: 0 }}>{isAr ? 'طلب حملة' : 'Campaign request'}</h2>
        {!authed ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              {isAr ? 'سجل الدخول لإنشاء طلب حملة وربطه بحسابك.' : 'Login to create a campaign request on your account.'}
            </p>
            <Link className="btn btn-primary" href="/login" style={{ width: 'fit-content' }}>
              {isAr ? 'تسجيل الدخول' : 'Login'}
            </Link>
          </div>
        ) : (
          <form className="grid-2" onSubmit={submit}>
            <label className="stack">
              <span>{isAr ? 'اسم الحملة' : 'Campaign name'}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="stack">
              <span>{isAr ? 'الهدف' : 'Objective'}</span>
              <select className="select" value={objective} onChange={(e) => setObjective(e.target.value)}>
                <option value="views">{isAr ? 'مشاهدات' : 'Views'}</option>
                <option value="visits">{isAr ? 'زيارات' : 'Visits'}</option>
                <option value="launch">{isAr ? 'إطلاق' : 'Launch'}</option>
                <option value="seasonal">{isAr ? 'موسمي' : 'Seasonal'}</option>
                <option value="multi-ad">{isAr ? 'متعدد الإعلانات' : 'Multi-ad'}</option>
              </select>
            </label>
            <label className="stack">
              <span>{isAr ? 'الميزانية SAR' : 'Budget SAR'}</span>
              <input className="input" type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} required />
            </label>
            <label className="stack">
              <span>{isAr ? 'المدينة' : 'City'}</span>
              <select className="select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                <option value="">{isAr ? 'كل السعودية' : 'Nationwide'}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {isAr ? city.nameAr : city.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span>{isAr ? 'القسم' : 'Category'}</span>
              <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">{isAr ? 'كل الأقسام' : 'All categories'}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {isAr ? category.nameAr : category.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span>{isAr ? 'تاريخ البداية' : 'Start date'}</span>
              <input className="input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="stack">
              <span>{isAr ? 'تاريخ النهاية' : 'End date'}</span>
              <input className="input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
            <label className="stack">
              <span>{isAr ? 'ملاحظات' : 'Notes'}</span>
              <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="success">{message}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={busy || !name || Number(budget) <= 0}>
              {busy ? (isAr ? 'جاري الإرسال...' : 'Sending...') : isAr ? 'إرسال الطلب' : 'Submit request'}
            </button>
          </form>
        )}
      </section>

      {authed ? (
        <section className="stack">
          <h2 style={{ marginBottom: 0 }}>{isAr ? 'حملاتي' : 'My campaigns'}</h2>
          {campaigns.length === 0 ? <p className="muted">{isAr ? 'لا توجد حملات بعد.' : 'No campaigns yet.'}</p> : null}
          <div className="grid-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="panel stack">
                <strong>{campaign.name}</strong>
                <span className="badge">{campaign.status}</span>
                <span className="muted">
                  {campaign.budgetTotal} {campaign.currency}
                </span>
                <span className="muted">{describeTargeting(campaign, isAr)}</span>
                <span className="muted">
                  {isAr ? 'الإعلانات' : 'Ads'}: {campaign.ads?.length ?? 0}
                </span>
                <div className="hero-actions">
                  {campaign.status === 'ACTIVE' ? (
                    <button className="btn btn-ghost" onClick={() => transitionCampaign(campaign.id, 'pause')}>
                      {isAr ? 'إيقاف مؤقت' : 'Pause'}
                    </button>
                  ) : null}
                  {campaign.status === 'PAUSED' ? (
                    <button className="btn btn-ghost" onClick={() => transitionCampaign(campaign.id, 'resume')}>
                      {isAr ? 'استئناف' : 'Resume'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
