import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@e3lani/i18n';
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
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');

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
        <Pressable style={styles.upload}>
          <Text style={styles.uploadIcon}>↑</Text>
          <Text style={styles.uploadTitle}>صور أو فيديو</Text>
          <Text style={styles.uploadHint}>حتى 10 ملفات · فيديو حتى 60 ثانية · بدون تحويل صور إلى فيديو</Text>
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

      {step > 1 ? (
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>خطوة {t('ar', steps[step]!)} — ستُربط بـ API عند اكتمال النواة</Text>
        </View>
      ) : null}

      <View style={styles.footerNote}>
        <Text style={styles.note}>المراجعة قبل الدفع. لن يُنشأ طلب دفع قبل قبول النسخة الحالية.</Text>
      </View>

      <Pressable
        style={styles.next}
        onPress={() => setStep((current) => Math.min(current + 1, steps.length - 1))}
      >
        <Text style={styles.nextText}>{t('ar', 'create.next')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  heading: {
    color: colors.black,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 16,
  },
  progress: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary },
  stepLabel: {
    color: colors.black,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 16,
  },
  upload: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CFCFCF',
    borderRadius: 18,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 20,
    gap: 8,
  },
  uploadIcon: { fontSize: 36, color: colors.primary, fontWeight: '700' },
  uploadTitle: { fontSize: 18, fontWeight: '800', color: colors.black },
  uploadHint: { color: colors.gray, textAlign: 'center', lineHeight: 20 },
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
  placeholderBox: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  placeholderText: { color: colors.gray, textAlign: 'center', lineHeight: 22 },
  footerNote: { marginTop: 'auto', marginBottom: 12 },
  note: { color: colors.gray, textAlign: 'right', lineHeight: 20 },
  next: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: colors.black, fontWeight: '800', fontSize: 17 },
});
