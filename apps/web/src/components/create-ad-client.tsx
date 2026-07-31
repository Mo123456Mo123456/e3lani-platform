'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { AdDto, CategoryDto, CityDto, MediaDto } from '@e3lani/types';
import { MEDIA_LIMITS } from '@e3lani/config';
import { Badge, Button, Card, Input, Select, Spinner, Textarea } from '@e3lani/ui';
import { API_URL } from '@/lib/api';
import { authedFetch, session } from '@/lib/session';

const CONTACT_OPTIONS = [
  { value: 'WHATSAPP', label: 'واتساب', placeholder: '05xxxxxxxx' },
  { value: 'PHONE', label: 'اتصال', placeholder: '05xxxxxxxx' },
  { value: 'STORE_LINK', label: 'رابط المتجر', placeholder: 'https://store.salla.sa' },
  { value: 'PRODUCT_LINK', label: 'رابط المنتج', placeholder: 'https://store.salla.sa/product' },
  { value: 'EXTERNAL_LINK', label: 'رابط خارجي معتمد', placeholder: 'https://instagram.com/…' },
] as const;

interface UploadedMedia extends MediaDto {
  localPreview?: string;
}

/** إضافة إعلان: وسائط ← تفاصيل ← وسيلة تواصل ← نشر. */
export function CreateAdClient({
  categories,
  cities,
  publishingMode,
  paymentsEnabled,
}: {
  categories: CategoryDto[];
  cities: CityDto[];
  publishingMode: 'FREE' | 'PAID';
  paymentsEnabled: boolean;
}) {
  const router = useRouter();
  const [media, setMedia] = React.useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    categoryId: '',
    subcategoryId: '',
    cityId: '',
    reachScope: 'CITY' as 'CITY' | 'KINGDOM',
    price: '',
    contactMethod: 'WHATSAPP' as (typeof CONTACT_OPTIONS)[number]['value'],
    contactValue: '',
  });

  React.useEffect(() => {
    if (!session.accessToken()) router.replace('/login?next=/create');
  }, [router]);

  const subcategories = categories.find((item) => item.id === form.categoryId)?.children ?? [];
  const contactOption = CONTACT_OPTIONS.find((option) => option.value === form.contactMethod)!;
  const hasVideo = media.some((item) => item.type === 'VIDEO');

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/');
        if (isVideo && media.length) {
          throw new Error('اختر إما فيديو واحدًا أو صورًا، وليس الاثنين معًا');
        }
        if (!isVideo && media.length >= MEDIA_LIMITS.maxImagesPerAd) {
          throw new Error(`الحد الأقصى ${MEDIA_LIMITS.maxImagesPerAd} صور`);
        }

        const created = await authedFetch<{
          mediaId: string;
          uploadUrl: string;
          headers: Record<string, string>;
        }>('/media/uploads', {
          method: 'POST',
          body: JSON.stringify({
            type: isVideo ? 'VIDEO' : 'IMAGE',
            mimeType: file.type,
            sizeBytes: file.size,
            fileName: file.name,
            purpose: 'AD',
          }),
        });

        const uploadResponse = await fetch(created.uploadUrl, {
          method: 'PUT',
          headers: created.headers,
          body: file,
        });
        if (!uploadResponse.ok) throw new Error('تعذّر رفع الملف، حاول مجددًا');

        const completed = await authedFetch<MediaDto>('/media/uploads/complete', {
          method: 'POST',
          body: JSON.stringify({ mediaId: created.mediaId }),
        });

        setMedia((current) => [
          ...current,
          { ...completed, localPreview: URL.createObjectURL(file) },
        ]);
      }
    } catch (err: any) {
      setError(err.message ?? 'تعذّر رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (mediaId: string) => {
    setMedia((current) => current.filter((item) => item.id !== mediaId));
    await authedFetch(`/media/${mediaId}`, { method: 'DELETE' }).catch(() => undefined);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!media.length) {
      setError('أضف صورة أو فيديو للإعلان');
      return;
    }
    setSubmitting(true);
    try {
      const ad = await authedFetch<AdDto>('/ads', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          categoryId: form.categoryId,
          subcategoryId: form.subcategoryId || undefined,
          cityId: form.cityId,
          reachScope: form.reachScope,
          extraCityIds: [],
          price: form.price ? Number(form.price) : null,
          contactMethod: form.contactMethod,
          contactValue: form.contactValue,
          mediaIds: media.map((item) => item.id),
        }),
      });

      const published = await authedFetch<AdDto>(`/ads/${ad.id}/publish`, { method: 'POST' });
      router.replace(published.status === 'ACTIVE' ? `/ad/${ad.id}` : '/account');
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? err.message ?? 'تعذّر نشر الإعلان');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4 pb-10">
      <header className="space-y-1">
        <h1 className="text-xl font-extrabold">أضف إعلانًا</h1>
        <p className="text-sm text-ink-muted">
          {publishingMode === 'FREE'
            ? 'النشر مجاني حاليًا ويظهر إعلانك مباشرة بعد الفحص الآلي.'
            : 'سيُطلب إتمام الدفع قبل ظهور الإعلان.'}
        </p>
        {publishingMode === 'FREE' ? <Badge tone="success">نشر مباشر</Badge> : <Badge tone="warning">بانتظار الدفع</Badge>}
      </header>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Card className="space-y-3 p-4">
        <h2 className="font-bold">الوسائط</h2>
        <p className="text-xs text-ink-muted">
          فيديو واحد حتى {MEDIA_LIMITS.maxVideoSeconds} ثانية، أو من ١ إلى {MEDIA_LIMITS.maxImagesPerAd} صور.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {media.map((item) => (
            <div key={item.id} className="relative aspect-[4/5] overflow-hidden rounded-md bg-surface">
              {item.type === 'VIDEO' ? (
                <video src={item.localPreview ?? item.url ?? undefined} className="h-full w-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.localPreview ?? item.url ?? ''}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => void removeMedia(item.id)}
                aria-label="حذف"
                className="absolute end-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {!hasVideo && media.length < MEDIA_LIMITS.maxImagesPerAd ? (
            <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-md border-2 border-dashed border-line text-ink-muted">
              {uploading ? <Spinner /> : <ImagePlus size={22} />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                multiple
                hidden
                onChange={(event) => void handleFiles(event.target.files)}
              />
            </label>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-bold">التفاصيل</h2>
        <Input
          label="عنوان الإعلان"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          maxLength={80}
          required
        />
        <Textarea
          label="الوصف (اختياري)"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          maxLength={1000}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="القسم الرئيسي"
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value, subcategoryId: '' })}
            required
          >
            <option value="">اختر القسم</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameAr}
              </option>
            ))}
          </Select>
          <Select
            label="القسم الفرعي"
            value={form.subcategoryId}
            onChange={(event) => setForm({ ...form, subcategoryId: event.target.value })}
            disabled={!subcategories.length}
          >
            <option value="">بدون</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.nameAr}
              </option>
            ))}
          </Select>
          <Select
            label="المدينة"
            value={form.cityId}
            onChange={(event) => setForm({ ...form, cityId: event.target.value })}
            required
          >
            <option value="">اختر المدينة</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.nameAr}
              </option>
            ))}
          </Select>
          <Select
            label="نطاق العرض"
            value={form.reachScope}
            onChange={(event) =>
              setForm({ ...form, reachScope: event.target.value as 'CITY' | 'KINGDOM' })
            }
          >
            <option value="CITY">المدينة فقط</option>
            <option value="KINGDOM">جميع مناطق المملكة</option>
          </Select>
        </div>
        <Input
          label="السعر (اختياري)"
          type="number"
          min={0}
          value={form.price}
          onChange={(event) => setForm({ ...form, price: event.target.value })}
          hint="اتركه فارغًا إذا لم ترغب بعرض سعر."
        />
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-bold">وسيلة التواصل</h2>
        <Select
          label="الطريقة"
          value={form.contactMethod}
          onChange={(event) =>
            setForm({ ...form, contactMethod: event.target.value as typeof form.contactMethod })
          }
        >
          {CONTACT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          label="القيمة"
          placeholder={contactOption.placeholder}
          value={form.contactValue}
          onChange={(event) => setForm({ ...form, contactValue: event.target.value })}
          required
        />
        {!paymentsEnabled ? (
          <p className="text-xs text-ink-muted">
            خدمات الترويج (الإبراز، أعلى القسم، التمديد) ستتاح فور تفعيل الدفع.
          </p>
        ) : null}
      </Card>

      <Button type="submit" fullWidth loading={submitting} size="lg">
        نشر الإعلان
      </Button>
    </form>
  );
}
