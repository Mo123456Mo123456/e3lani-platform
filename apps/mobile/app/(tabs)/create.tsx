import * as React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { MEDIA_LIMITS } from '@e3lani/config';
import type { AdDto, CategoryDto, CityDto, MediaDto } from '@e3lani/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { Badge, Button, Card, EmptyState, Field, Loading } from '@/components/ui';

const CONTACT_METHODS = [
  { value: 'WHATSAPP', label: 'واتساب', placeholder: '05xxxxxxxx' },
  { value: 'PHONE', label: 'اتصال', placeholder: '05xxxxxxxx' },
  { value: 'STORE_LINK', label: 'رابط المتجر', placeholder: 'https://store.salla.sa' },
  { value: 'PRODUCT_LINK', label: 'رابط المنتج', placeholder: 'https://store.salla.sa/p/1' },
  { value: 'EXTERNAL_LINK', label: 'رابط خارجي', placeholder: 'https://instagram.com/…' },
] as const;

interface UploadedMedia extends MediaDto {
  localUri: string;
}

/** إضافة إعلان: وسائط ← تفاصيل ← وسيلة تواصل ← نشر. */
export default function CreateAdScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [categories, setCategories] = React.useState<CategoryDto[]>([]);
  const [cities, setCities] = React.useState<CityDto[]>([]);
  const [publishingMode, setPublishingMode] = React.useState<'FREE' | 'PAID'>('FREE');
  const [media, setMedia] = React.useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    categoryId: '',
    subcategoryId: '',
    cityId: '',
    reachScope: 'CITY' as 'CITY' | 'KINGDOM',
    price: '',
    contactMethod: 'WHATSAPP' as (typeof CONTACT_METHODS)[number]['value'],
    contactValue: '',
  });

  useFocusEffect(
    React.useCallback(() => {
      void Promise.all([
        api<CategoryDto[]>('/categories'),
        api<CityDto[]>('/cities'),
        api<{ publishingMode: 'FREE' | 'PAID' }>('/pricing'),
      ])
        .then(([categoryRows, cityRows, pricing]) => {
          setCategories(categoryRows);
          setCities(cityRows);
          setPublishingMode(pricing.publishingMode);
        })
        .catch(() => undefined);
    }, []),
  );

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="سجّل الدخول لإضافة إعلان"
          action={<Button title="تسجيل الدخول" onPress={() => router.push('/login')} />}
        />
      </View>
    );
  }

  const subcategories = categories.find((item) => item.id === form.categoryId)?.children ?? [];
  const hasVideo = media.some((item) => item.type === 'VIDEO');
  const contactMethod = CONTACT_METHODS.find((item) => item.value === form.contactMethod)!;

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.9,
      videoMaxDuration: MEDIA_LIMITS.maxVideoSeconds,
      allowsMultipleSelection: !hasVideo,
      selectionLimit: MEDIA_LIMITS.maxImagesPerAd - media.length,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        const isVideo = asset.type === 'video';
        if (isVideo && media.length) {
          Alert.alert('تنبيه', 'اختر إما فيديو واحدًا أو صورًا، وليس الاثنين معًا');
          break;
        }
        const mimeType = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');

        const created = await api<{ mediaId: string; uploadUrl: string; headers: Record<string, string> }>(
          '/media/uploads',
          {
            method: 'POST',
            auth: true,
            body: JSON.stringify({
              type: isVideo ? 'VIDEO' : 'IMAGE',
              mimeType,
              sizeBytes: asset.fileSize ?? 1024,
              fileName: asset.fileName ?? undefined,
              purpose: 'AD',
            }),
          },
        );

        const blob = await (await fetch(asset.uri)).blob();
        const uploadResponse = await fetch(created.uploadUrl, {
          method: 'PUT',
          headers: created.headers,
          body: blob,
        });
        if (!uploadResponse.ok) throw new Error('تعذّر رفع الملف');

        const completed = await api<MediaDto>('/media/uploads/complete', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({ mediaId: created.mediaId }),
        });

        setMedia((current) => [...current, { ...completed, localUri: asset.uri }]);
      }
    } catch (error: any) {
      Alert.alert('تعذّر الرفع', error?.message ?? 'حاول مرة أخرى');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!media.length) {
      Alert.alert('تنبيه', 'أضف صورة أو فيديو للإعلان');
      return;
    }
    setSubmitting(true);
    try {
      const ad = await api<AdDto>('/ads', {
        method: 'POST',
        auth: true,
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

      const published = await api<AdDto>(`/ads/${ad.id}/publish`, { method: 'POST', auth: true });
      setMedia([]);
      setForm({
        title: '', description: '', categoryId: '', subcategoryId: '', cityId: '',
        reachScope: 'CITY', price: '', contactMethod: 'WHATSAPP', contactValue: '',
      });
      router.replace(published.status === 'ACTIVE' ? `/ad/${ad.id}` : '/(tabs)/account');
    } catch (error: any) {
      Alert.alert('تعذّر النشر', error?.errors?.[0]?.message ?? error?.message ?? 'حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 6 }}>
        <Text style={theme.text.title}>أضف إعلانًا</Text>
        <Text style={theme.text.caption}>
          {publishingMode === 'FREE'
            ? 'النشر مجاني حاليًا ويظهر إعلانك مباشرة بعد الفحص الآلي.'
            : 'سيُطلب إتمام الدفع قبل ظهور الإعلان.'}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <Badge
            label={publishingMode === 'FREE' ? 'نشر مباشر' : 'بانتظار الدفع'}
            tone={publishingMode === 'FREE' ? 'success' : 'warning'}
          />
        </View>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={theme.text.subtitle}>الوسائط</Text>
        <Text style={theme.text.caption}>
          فيديو واحد حتى {MEDIA_LIMITS.maxVideoSeconds} ثانية، أو من ١ إلى {MEDIA_LIMITS.maxImagesPerAd} صور.
        </Text>
        <View style={styles.mediaGrid}>
          {media.map((item) => (
            <View key={item.id} style={styles.mediaItem}>
              <Image source={{ uri: item.localUri }} style={styles.mediaImage} contentFit="cover" />
              <Pressable
                style={styles.removeButton}
                onPress={() => {
                  setMedia((current) => current.filter((entry) => entry.id !== item.id));
                  void api(`/media/${item.id}`, { method: 'DELETE', auth: true }).catch(() => undefined);
                }}
              >
                <Ionicons name="trash" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          {!hasVideo && media.length < MEDIA_LIMITS.maxImagesPerAd ? (
            <Pressable style={styles.addMedia} onPress={pickMedia} disabled={uploading}>
              {uploading ? (
                <Loading />
              ) : (
                <Ionicons name="add-circle-outline" size={26} color={theme.colors.inkMuted} />
              )}
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={theme.text.subtitle}>التفاصيل</Text>
        <Field
          label="عنوان الإعلان"
          value={form.title}
          onChangeText={(value) => setForm({ ...form, title: value })}
          maxLength={80}
        />
        <Field
          label="الوصف (اختياري)"
          value={form.description}
          onChangeText={(value) => setForm({ ...form, description: value })}
          multiline
          numberOfLines={4}
          style={{ height: 'auto' }}
        />

        <Text style={styles.label}>القسم الرئيسي</Text>
        <View style={styles.chips}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setForm({ ...form, categoryId: category.id, subcategoryId: '' })}
              style={[styles.chip, form.categoryId === category.id ? styles.chipActive : null]}
            >
              <Text style={styles.chipText}>{category.nameAr}</Text>
            </Pressable>
          ))}
        </View>

        {subcategories.length ? (
          <>
            <Text style={styles.label}>القسم الفرعي</Text>
            <View style={styles.chips}>
              {subcategories.map((sub) => (
                <Pressable
                  key={sub.id}
                  onPress={() => setForm({ ...form, subcategoryId: sub.id })}
                  style={[styles.chip, form.subcategoryId === sub.id ? styles.chipActive : null]}
                >
                  <Text style={styles.chipText}>{sub.nameAr}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.label}>المدينة</Text>
        <View style={styles.chips}>
          {cities.map((city) => (
            <Pressable
              key={city.id}
              onPress={() => setForm({ ...form, cityId: city.id })}
              style={[styles.chip, form.cityId === city.id ? styles.chipActive : null]}
            >
              <Text style={styles.chipText}>{city.nameAr}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>نطاق العرض</Text>
        <View style={styles.chips}>
          {(
            [
              ['CITY', 'المدينة فقط'],
              ['KINGDOM', 'جميع مناطق المملكة'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setForm({ ...form, reachScope: value })}
              style={[styles.chip, form.reachScope === value ? styles.chipActive : null]}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="السعر (اختياري)"
          value={form.price}
          onChangeText={(value) => setForm({ ...form, price: value })}
          keyboardType="numeric"
          hint="اتركه فارغًا إذا لم ترغب بعرض سعر."
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={theme.text.subtitle}>وسيلة التواصل</Text>
        <View style={styles.chips}>
          {CONTACT_METHODS.map((method) => (
            <Pressable
              key={method.value}
              onPress={() => setForm({ ...form, contactMethod: method.value })}
              style={[styles.chip, form.contactMethod === method.value ? styles.chipActive : null]}
            >
              <Text style={styles.chipText}>{method.label}</Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="القيمة"
          placeholder={contactMethod.placeholder}
          value={form.contactValue}
          onChangeText={(value) => setForm({ ...form, contactValue: value })}
          autoCapitalize="none"
        />
      </Card>

      <Button title="نشر الإعلان" onPress={submit} loading={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.ink },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaItem: { width: 88, height: 110, borderRadius: theme.radius.md, overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%', backgroundColor: theme.colors.surface },
  removeButton: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMedia: {
    width: 88,
    height: 110,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
