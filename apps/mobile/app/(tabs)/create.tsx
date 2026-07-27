import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { pollMediaReady, uploadFileToSignedUrl } from '@e3lani/api-client';
import type { Category, City } from '@e3lani/api-client';
import { t } from '@e3lani/i18n';
import { api, getToken } from '../../src/lib/api';
import { colors } from '../../src/theme';

const steps = [
  'create.stepMedia',
  'create.stepTitle',
  'create.stepCategory',
  'create.stepCity',
  'create.stepContact',
  'create.stepPreview',
] as const;

export default function CreateAdScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  const [mediaStatus, setMediaStatus] = useState('');
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
  }

  async function submit() {
    if (!file) {
      Alert.alert('الوسائط مطلوبة');
      return;
    }
    setBusy(true);
    try {
      const kind = file.mimeType.startsWith('video/') ? 'video' : 'image';
      if (kind === 'video' && file.size > 200 * 1024 * 1024) {
        throw new Error('الفيديو يتجاوز 200MB');
      }
      const ad = await api.createAd({
        title,
        categoryId,
        countryCode: 'SA',
        cityId,
        contactMethods: { whatsapp },
      });
      setMediaStatus('UPLOADING');
      const intent = await api.uploadIntent({
        kind,
        mimeType: file.mimeType,
        sizeBytes: file.size || 1,
        durationSeconds: kind === 'video' ? 2 : undefined,
      });
      const blob = await (await fetch(file.uri)).blob();
      await uploadFileToSignedUrl(intent.uploadUrl, blob, intent.headers);
      setMediaStatus('PROCESSING');
      await api.completeUpload(intent.assetId);
      const ready = await pollMediaReady(api, intent.assetId, { timeoutMs: 120000 });
      if (ready.status === 'FAILED') throw new Error('فشلت معالجة الوسائط');
      setMediaStatus('READY');
      await api.attachMedia(ad.id, intent.assetId, 0);
      await api.submitReview(ad.id);
      Alert.alert('تم الإرسال', 'الإعلان قيد المراجعة');
      router.push('/account');
    } catch (e) {
      Alert.alert('خطأ', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}>
      <Text style={styles.heading}>إنشاء إعلان</Text>
      <View style={styles.progress}>
        {steps.map((_, index) => (
          <View key={index} style={[styles.dot, index <= step && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.stepLabel}>
        {step + 1}. {t('ar', steps[step]!)}
      </Text>

      {step === 0 ? (
        <Pressable style={styles.upload} onPress={pickMedia}>
          <Text style={styles.uploadTitle}>{file ? file.name : 'صور أو فيديو'}</Text>
          <Text style={styles.uploadHint}>MP4/MOV حتى 60 ثانية و200MB</Text>
          {mediaStatus ? <Text style={styles.status}>الحالة: {mediaStatus}</Text> : null}
        </Pressable>
      ) : null}
      {step === 1 ? (
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="عنوان الإعلان"
          placeholderTextColor={colors.gray}
          style={styles.input}
          textAlign="right"
        />
      ) : null}
      {step === 2 ? (
        <View style={styles.list}>
          {categories.slice(0, 8).map((c) => (
            <Pressable key={c.id} style={[styles.chip, categoryId === c.id && styles.chipOn]} onPress={() => setCategoryId(c.id)}>
              <Text>{c.nameAr}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {step === 3 ? (
        <View style={styles.list}>
          {cities.map((c) => (
            <Pressable key={c.id} style={[styles.chip, cityId === c.id && styles.chipOn]} onPress={() => setCityId(c.id)}>
              <Text>{c.nameAr}</Text>
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
          textAlign="right"
        />
      ) : null}
      {step === 5 ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{title || 'بدون عنوان'}</Text>
          <Text style={styles.uploadHint}>المراجعة مجانية. الدفع 19 ر.س بعد القبول فقط.</Text>
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
        <Text style={styles.nextText}>{step < steps.length - 1 ? t('ar', 'create.next') : 'إرسال للمراجعة'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  heading: { color: colors.black, fontSize: 28, fontWeight: '800', textAlign: 'right', marginBottom: 16 },
  progress: { flexDirection: 'row-reverse', gap: 8, marginBottom: 18 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  stepLabel: { color: colors.black, fontSize: 18, fontWeight: '700', textAlign: 'right', marginBottom: 16 },
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
  previewTitle: { fontWeight: '800', fontSize: 18, textAlign: 'right' },
  next: {
    marginTop: 'auto',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: colors.black, fontWeight: '800', fontSize: 17 },
});
