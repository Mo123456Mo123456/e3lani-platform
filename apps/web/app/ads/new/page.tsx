'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Category, City } from '@e3lani/api-client';
import { pollMediaReady, uploadFileToSignedUrl } from '@e3lani/api-client';
import { api, getToken } from '../../../lib/api';

const steps = ['الوسائط', 'العنوان', 'القسم', 'المدينة', 'التواصل', 'معاينة'];

function mediaKind(file: File): 'image' | 'video' {
  return file.type.startsWith('video/') ? 'video' : 'image';
}

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
  const [files, setFiles] = useState<File[]>([]);
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

  const imageCount = useMemo(
    () => files.filter((file) => mediaKind(file) === 'image').length,
    [files],
  );
  const videoCount = useMemo(
    () => files.filter((file) => mediaKind(file) === 'video').length,
    [files],
  );
  const canProceedMedia = imageCount >= 1 || videoCount >= 1;

  async function uploadOne(adId: string, file: File, sortOrder: number) {
    const kind = mediaKind(file);
    if (kind === 'video' && file.size > 200 * 1024 * 1024) {
      throw new Error('الفيديو يتجاوز 200MB');
    }
    const intent = await api.uploadIntent({
      kind,
      mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      sizeBytes: file.size,
      durationSeconds: kind === 'video' ? 2 : undefined,
    });
    await uploadFileToSignedUrl(intent.uploadUrl, file, intent.headers);
    await api.completeUpload(intent.assetId);
    const ready = await pollMediaReady(api, intent.assetId, { timeoutMs: 180000 });
    if (ready.status === 'FAILED') throw new Error(`فشلت معالجة الوسائط: ${file.name}`);
    await api.attachMedia(adId, intent.assetId, sortOrder);
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (files.length === 0) throw new Error('اختر صورة أو فيديو');
      if (imageCount > 5) throw new Error('الحد الأقصى 5 صور');
      if (videoCount > 1) throw new Error('فيديو واحد فقط لكل إعلان');

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

      // Images first, then videos — matches feed poster expectations.
      const ordered = [
        ...files.filter((file) => mediaKind(file) === 'image'),
        ...files.filter((file) => mediaKind(file) === 'video'),
      ];
      for (let i = 0; i < ordered.length; i++) {
        setMediaStatus(`UPLOADING ${i + 1}/${ordered.length}`);
        await uploadOne(ad.id, ordered[i], i);
      }
      setMediaStatus('READY');
      const published = await api.publishAd(ad.id);
      if (published.status === 'ACTIVE') {
        router.push(`/ads/${ad.id}`);
      } else if (published.status === 'PAYMENT_PENDING') {
        router.push(`/ads/${ad.id}/pay`);
      } else {
        router.push(`/ads/${ad.id}/status`);
      }
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
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <p className="muted">
              صورة أو فيديو: 1–5 صور (JPG/PNG/WebP) أو فيديو واحد (MP4/MOV حتى 60 ثانية و200MB).
            </p>
            {files.length > 0 ? (
              <ul className="muted" style={{ margin: 0, paddingInlineStart: 18 }}>
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB · {mediaKind(file)}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="badge">
              صور: {imageCount} · فيديو: {videoCount}
            </p>
            {mediaStatus ? <p className="badge">حالة الوسائط: {mediaStatus}</p> : null}
          </>
        ) : null}
        {step === 1 ? (
          <>
            <input
              className="input"
              placeholder="عنوان الإعلان"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="textarea"
              placeholder="الوصف (اختياري)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            <input
              className="input"
              placeholder="واتساب"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <input
              className="input"
              placeholder="رابط المتجر (اختياري)"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
            />
          </>
        ) : null}
        {step === 5 ? (
          <div className="stack">
            <strong>{title || 'بدون عنوان'}</strong>
            <span className="muted">{description || 'بدون وصف'}</span>
            <span className="muted">
              وسائط: {imageCount} صورة · {videoCount} فيديو
            </span>
            <span>النشر مجاني حاليًا — يُنشر مباشرة بعد الفحص الآلي بدون مراجعة بشرية.</span>
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
                (step === 0 && !canProceedMedia) ||
                (step === 1 && title.trim().length < 3) ||
                (step === 2 && !categoryId) ||
                (step === 3 && !cityId)
              }
            >
              التالي
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={busy || !categoryId || !cityId || !canProceedMedia}
            >
              {busy ? 'جاري الرفع والمعالجة...' : 'نشر الإعلان'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
