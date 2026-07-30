import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { pollMediaReady } from '@e3lani/api-client';
import type { Category, City } from '@e3lani/api-client';
import { api, getToken } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { colors } from '../../src/theme';

const steps = [
  'create.stepMedia',
  'create.stepTitle',
  'create.stepCategory',
  'create.stepCity',
  'create.stepContact',
  'create.stepPreview',
] as const;

type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'processing' | 'ready';

function uploadFileToSignedUrlWithProgress(
  uploadUrl: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(0.98, event.loaded / event.total));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}

function formatBytes(size: number) {
  if (!size) return '';
  const mb = size / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export default function CreateAdScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t, textAlign } = useLocale();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [whatsapp, setWhatsapp] = useState('+966512345678');
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [file, setFile] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(
    null,
  );
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    Promise.all([api.categories(), api.cities()]).then(([cats, cts]) => {
      setCategories(cats);
      setCities(cts);
      if (cats[0]) setCategoryId(cats[0].id);
      if (cts[0]) setCityId(cts[0].id);
    });
  }, [router]);

  async function pickMedia() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'video/mp4', 'video/quicktime'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size || 0,
    });
    setUploadPhase('idle');
    setUploadProgress(0);
  }

  async function submit() {
    if (!file) {
      Alert.alert(t('create.mediaRequired'));
      return;
    }
    setBusy(true);
    setUploadPhase('preparing');
    setUploadProgress(0.05);
    try {
      const kind = file.mimeType.startsWith('video/') ? 'video' : 'image';
      if (kind === 'video' && file.size > 200 * 1024 * 1024) {
        throw new Error(locale === 'ar' ? 'الفيديو يتجاوز 200MB' : 'Video exceeds 200MB');
      }
      const ad = await api.createAd({
        title,
        categoryId,
        countryCode: 'SA',
        cityId,
        contactMethods: { whatsapp },
      });
      setUploadPhase('preparing');
      setUploadProgress(0.12);
      const intent = await api.uploadIntent({
        kind,
        mimeType: file.mimeType,
        sizeBytes: file.size || 1,
        durationSeconds: kind === 'video' ? 2 : undefined,
      });
      const blob = await (await fetch(file.uri)).blob();
      setUploadPhase('uploading');
      setUploadProgress(0.2);
      await uploadFileToSignedUrlWithProgress(intent.uploadUrl, blob, intent.headers, (progress) =>
        setUploadProgress(0.2 + progress * 0.6),
      );
      setUploadPhase('processing');
      setUploadProgress(0.85);
      await api.completeUpload(intent.assetId);
      const ready = await pollMediaReady(api, intent.assetId, { timeoutMs: 120000 });
      if (ready.status === 'FAILED') {
        throw new Error(locale === 'ar' ? 'فشلت معالجة الوسائط' : 'Media processing failed');
      }
      setUploadPhase('ready');
      setUploadProgress(1);
      await api.attachMedia(ad.id, intent.assetId, 0);
      const published = await api.publishAd(ad.id);
      Alert.alert(
        locale === 'ar' ? 'تم النشر' : 'Published',
        published.status === 'ACTIVE'
          ? locale === 'ar'
            ? 'إعلانك نشط الآن في الموجز'
            : 'Your ad is live in the feed'
          : locale === 'ar'
            ? `الحالة: ${published.status}`
            : `Status: ${published.status}`,
      );
      router.push(published.status === 'ACTIVE' ? '/' : '/account');
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { textAlign }]}>{t('create.title')}</Text>
      <View style={styles.progress}>
        {steps.map((_, index) => (
          <View key={index} style={[styles.dot, index <= step && styles.dotActive]} />
        ))}
      </View>
      <Text style={[styles.stepLabel, { textAlign }]}>
        {step + 1}. {t(steps[step]!)}
      </Text>

      {step === 0 ? (
        <Pressable style={styles.upload} onPress={pickMedia}>
          <Text style={[styles.uploadTitle, { textAlign }]}>{file ? file.name : t('create.pickMedia')}</Text>
          <Text style={styles.uploadHint}>{file ? `${file.mimeType} ${formatBytes(file.size)}` : t('create.mediaHint')}</Text>
          {uploadPhase !== 'idle' ? (
            <View style={styles.uploadProgressWrap}>
              <View style={styles.uploadProgressTrack}>
                <View style={[styles.uploadProgressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
              </View>
              <Text style={styles.status}>
                {uploadPhase === 'preparing'
                  ? t('create.uploadPreparing')
                  : uploadPhase === 'uploading'
                    ? t('create.uploading')
                    : uploadPhase === 'processing'
                      ? t('create.processing')
                      : t('create.ready')}{' '}
                {Math.round(uploadProgress * 100)}%
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      {step === 1 ? (
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="عنوان الإعلان"
          placeholderTextColor={colors.gray}
          style={styles.input}
          textAlign={textAlign}
        />
      ) : null}
      {step === 2 ? (
        <View style={styles.list}>
          {categories.slice(0, 8).map((c) => (
            <Pressable key={c.id} style={[styles.chip, categoryId === c.id && styles.chipOn]} onPress={() => setCategoryId(c.id)}>
              <Text>{locale === 'ar' ? c.nameAr : c.nameEn}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {step === 3 ? (
        <View style={styles.list}>
          {cities.map((c) => (
            <Pressable key={c.id} style={[styles.chip, cityId === c.id && styles.chipOn]} onPress={() => setCityId(c.id)}>
              <Text>{locale === 'ar' ? c.nameAr : c.nameEn}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {step === 4 ? (
        <TextInput
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="واتساب"
          placeholderTextColor={colors.gray}
          style={styles.input}
          textAlign={textAlign}
        />
      ) : null}
      {step === 5 ? (
        <View style={styles.preview}>
          <Text style={[styles.previewTitle, { textAlign }]}>{title || (locale === 'ar' ? 'بدون عنوان' : 'Untitled')}</Text>
          <Text style={styles.uploadHint}>{t('create.reviewPrice')}</Text>
        </View>
      ) : null}

      {busy ? <ActivityIndicator color={colors.primary} /> : null}

      <Pressable
        style={styles.next}
        disabled={busy}
        onPress={() => {
          if (step < steps.length - 1) setStep((s) => s + 1);
          else void submit();
        }}
      >
        <Text style={styles.nextText}>{step < steps.length - 1 ? t('create.next') : t('create.submitReview')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  heading: { color: colors.black, fontSize: 28, fontWeight: '800', marginBottom: 16 },
  progress: { flexDirection: 'row-reverse', gap: 8, marginBottom: 18 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  stepLabel: { color: colors.black, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  upload: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CFCFCF',
    borderRadius: 18,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 20,
    gap: 8,
  },
  uploadTitle: { fontSize: 18, fontWeight: '800', color: colors.black },
  uploadHint: { color: colors.gray, textAlign: 'center' },
  status: { color: colors.black, fontWeight: '700' },
  uploadProgressWrap: { width: '100%', gap: 8, marginTop: 8 },
  uploadProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  uploadProgressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.surface,
  },
  list: { gap: 8 },
  chip: { padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary },
  preview: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 },
  previewTitle: { fontWeight: '800', fontSize: 18 },
  next: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: colors.black, fontWeight: '800', fontSize: 17 },
});
