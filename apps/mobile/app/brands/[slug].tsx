import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BrandProfile } from '@e3lani/api-client';
import { api } from '../../src/lib/api';
import { useLocale } from '../../src/lib/locale';
import { colors } from '../../src/theme';

export default function BrandScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { locale, t, rowDirection, textAlign } = useLocale();
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api
      .brand(String(slug))
      .then(setBrand)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>{t('brand.title')}</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={[styles.empty, { textAlign }]}>{error}</Text> : null}
      {brand ? (
        <>
          <View style={[styles.brandHeader, { flexDirection: rowDirection }]}>
            <View style={styles.logo}>
              {brand.logoUrl ? <Image source={{ uri: brand.logoUrl }} style={StyleSheet.absoluteFill} /> : null}
            </View>
            <View style={styles.brandText}>
              <Text style={[styles.name, { textAlign }]}>
                {locale === 'ar' ? brand.nameAr : brand.nameEn || brand.nameAr}
              </Text>
              {brand.isVerified ? <Text style={[styles.verified, { textAlign }]}>{t('brand.verified')}</Text> : null}
            </View>
          </View>
          {brand.bio ? <Text style={[styles.bio, { textAlign }]}>{brand.bio}</Text> : null}
          <Text style={[styles.section, { textAlign }]}>{t('brand.ads')}</Text>
          {brand.ads.map((ad) => (
            <Pressable key={ad.id} style={styles.row} onPress={() => router.push(`/ads/${ad.id}` as never)}>
              <Text style={[styles.rowTitle, { textAlign }]}>{ad.currentRevision?.title}</Text>
              <Text style={[styles.rowMeta, { textAlign }]}>
                {locale === 'ar' ? ad.currentRevision?.city?.nameAr : ad.currentRevision?.city?.nameEn}
              </Text>
            </Pressable>
          ))}
          {brand.ads.length === 0 ? <Text style={[styles.empty, { textAlign }]}>{t('feed.emptyTitle')}</Text> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  header: { alignItems: 'center', gap: 12, marginBottom: 18 },
  back: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: colors.black, fontWeight: '800' },
  title: { flex: 1, color: colors.black, fontSize: 26, fontWeight: '800' },
  brandHeader: { alignItems: 'center', gap: 14 },
  logo: {
    width: 74,
    height: 74,
    borderRadius: 37,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  brandText: { flex: 1 },
  name: { color: colors.black, fontSize: 24, fontWeight: '800' },
  verified: { color: colors.primary, fontWeight: '800', marginTop: 4 },
  bio: { color: colors.black, lineHeight: 22, marginTop: 18 },
  section: { color: colors.black, fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  row: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  rowTitle: { color: colors.black, fontWeight: '800' },
  rowMeta: { color: colors.gray, marginTop: 4 },
  empty: { color: colors.gray, marginTop: 16 },
});
