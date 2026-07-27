'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Category, City } from '@e3lani/api-client';
import { pollMediaReady, uploadFileToSignedUrl } from '@e3lani/api-client';
import { DEFAULT_SA_PRICING } from '@e3lani/types';
import { api, getToken } from '../../../lib/api';

const steps = ['الوسائط', 'العنوان', 'القسم', 'المدينة', 'التواصل', 'معاينة'];
const publishPrice = DEFAULT_SA_PRICING.AD_PUBLISH_30D;

export default function CreateAdPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [whatsapp, setWhatsapp] = useState('+966512345678');
  const [storeUrl, setStoreUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mediaStatus, setMediaStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    Promise.all([api.categories(), api.cities()]).then(([cats, cts]) => {
      setCategories(cats);
      setCities(cts);
      if (cats[0]) setCategoryId(cats[0].id);
      if (cts[0]) setCityId(cts[0].id);
    });
  }, [router]);

  const kind = useMemo(() => {
    if (!file) return null;
    return file.type.startsWith('video/') ? 'video' : 'image';
  }, [file]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (!file || !kind) throw new Error('اختر صورة أو فيديو');
      if (kind === 'video') {
        if (file.size > 200 * 1024 * 1024) throw new Error('الفيديو يتجاوز 200MB');
        // duration validated server-side when provided; client hint via video element optional
      }

      const ad = await api.createAd({
        title,
        description: description || undefined,
        categoryId,
        countryCode: 'SA',
        cityId,
        contactMethods: {
          ...(whatsapp ? { whatsapp } : {}),
          ...(storeUrl ? { storeUrl } : {}),
        },
      });

      setMediaStatus('UPLOADING');
      const intent = await api.uploadIntent({
        kind,
        mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        sizeBytes: file.size,
        durationSeconds: kind === 'video' ? 2 : undefined,
      });
      await uploadFileToSignedUrl(intent.uploadUrl, file, intent.headers);
      setMediaStatus('PROCESSING');
      await api.completeUpload(intent.assetId);
      const ready = await pollMediaReady(api, intent.assetId, { timeoutMs: 120000 });
      if (ready.status === 'FAILED') throw new Error('فشلت معالجة الوسائط');
      setMediaStatus('READY');
      await api.attachMedia(ad.id, intent.assetId, 0);
      await api.submitReview(ad.id);
      router.push(`/ads/${ad.id}/status`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <h1>إنشاء إعلان</h1>
      <div className="progress">
        {steps.map((_, i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <p>
        {step + 1}. {steps[step]}
      </p>

      <div className="panel stack">
        {step === 0 ? (
          <>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="muted">صور JPG/PNG/WebP أو فيديو MP4/MOV حتى 60 ثانية و200MB. لا تحويل صور إلى فيديو.</p>
            {file ? (
              <p>
                الملف: {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB · {kind}
              </p>
            ) : null}
            {mediaStatus ? <p className="badge">حالة الوسائط: {mediaStatus}</p> : null}
          </>
        ) : null}
        {step === 1 ? (
          <>
            <input className="input" placeholder="عنوان الإعلان" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="textarea" placeholder="الوصف (اختياري)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </>
        ) : null}
        {step === 2 ? (
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        ) : null}
        {step === 3 ? (
          <select className="select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        ) : null}
        {step === 4 ? (
          <>
            <input className="input" placeholder="واتساب" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            <input className="input" placeholder="رابط المتجر (اختياري)" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} />
          </>
        ) : null}
        {step === 5 ? (
          <div className="stack">
            <strong>{title || 'بدون عنوان'}</strong>
            <span className="muted">{description || 'بدون وصف'}</span>
            <span>
              المراجعة مجانية. الدفع يظهر بعد القبول فقط ({publishPrice.amount} {publishPrice.currency}).
            </span>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 ? (
            <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              رجوع
            </button>
          ) : null}
          {step < steps.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                busy ||
                (step === 0 && !file) ||
                (step === 1 && title.trim().length < 3) ||
                (step === 2 && !categoryId) ||
                (step === 3 && !cityId)
              }
            >
              التالي
            </button>
          ) : (
            <button className="btn btn-primary" onClick={submit} disabled={busy || !categoryId || !cityId || !file}>
              {busy ? 'جاري الرفع والمعالجة...' : 'إرسال للمراجعة'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
